import { PrismaClient, Prisma } from '@prisma/client';
import prisma from '../config/prisma';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrderItemInput {
  menuItemId: string;
  qty: number;
}

/**
 * Chi tiết thiếu hụt nguyên liệu — trả về trong InsufficientStockError
 * để caller có thể hiển thị thông báo chi tiết cho người dùng.
 */
export interface StockShortage {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  required: number;   // số lượng cần
  available: number;  // số lượng hiện có
  shortage: number;   // số lượng thiếu
}

/**
 * Error class cho trường hợp tồn kho không đủ.
 * Được ném ra bên trong transaction để trigger automatic rollback.
 */
export class InsufficientStockError extends Error {
  readonly shortages: StockShortage[];

  constructor(shortages: StockShortage[]) {
    const names = shortages.map(s => `"${s.ingredientName}" (thiếu ${s.shortage} ${s.unit})`).join(', ');
    super(`Nguyên liệu không đủ: ${names}`);
    this.name = 'InsufficientStockError';
    this.shortages = shortages;
  }
}

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * Trừ tồn kho tự động khi order được xác nhận.
 *
 * Thuật toán:
 *  1. Lấy toàn bộ BOM của tất cả menuItem trong order (1 query duy nhất).
 *  2. Gộp (aggregate) tổng nguyên liệu cần dùng cho toàn bộ order.
 *  3. Trong 1 Prisma interactive transaction:
 *     a. SELECT FOR UPDATE (đọc stock hiện tại với lock để tránh race condition).
 *     b. Kiểm tra toàn bộ stock — thu thập TẤT CẢ thiếu hụt trước khi throw
 *        (thay vì fail-fast) để UX báo lỗi đầy đủ cho manager.
 *     c. UPDATE stock và INSERT InventoryLog trong cùng 1 transaction.
 *
 * Tính ACID được đảm bảo:
 *  - Atomicity : Tất cả UPDATE + INSERT thành công hoặc tất cả rollback.
 *  - Consistency: Không bao giờ stock xuống dưới 0.
 *  - Isolation  : SELECT FOR UPDATE + interactive tx ngăn dirty/phantom reads.
 *  - Durability : Prisma commit → PostgreSQL WAL ghi vào disk.
 *
 * @param orderItems  Danh sách { menuItemId, qty } của các món đã order
 * @param sessionId   ID session (để ghi vào InventoryLog.orderId)
 * @param createdBy   userId của cashier/system xác nhận order
 * @param tx          Prisma transaction client — nếu được truyền vào,
 *                    function sẽ dùng chung tx thay vì tự tạo transaction mới.
 *                    (Cho phép compose với các transaction bên ngoài)
 */
export async function deductInventory(
  orderItems: OrderItemInput[],
  sessionId: string,
  createdBy: string,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  tenantId?: string,
  branchId?: string
): Promise<void> {
  // Nếu không có món nào → không cần làm gì
  if (!orderItems || orderItems.length === 0) return;

  // ── STEP 1: Lấy BOM của tất cả menuItem (batch query, ngoài transaction) ──

  const menuItemIds = [...new Set(orderItems.map(i => i.menuItemId))];

  const bomRecords = await prisma.bOM.findMany({
    where: { menuItemId: { in: menuItemIds } },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true, stock: true, minStock: true },
      },
    },
  });

  // Nếu không có BOM nào → bỏ qua (món chưa được cấu hình công thức)
  if (bomRecords.length === 0) return;

  // ── STEP 2: Aggregate tổng nguyên liệu cần dùng ──────────────────────────
  //
  //  Ví dụ: Order 2 tô Phở (BOM: 200g bánh phở, 150g thịt bò)
  //                + 1 Cà phê (BOM: 20g cà phê, 30g đường)
  //  → ingredientDemand = { 'ing_banhpho': 400, 'ing_thitbo': 300, 'ing_caphe': 20, 'ing_duong': 30 }

  const ingredientDemand = new Map<string, number>();

  for (const item of orderItems) {
    const itemBoms = bomRecords.filter(b => b.menuItemId === item.menuItemId);
    for (const bom of itemBoms) {
      const current = ingredientDemand.get(bom.ingredientId) ?? 0;
      ingredientDemand.set(bom.ingredientId, current + Number(bom.quantity) * item.qty);
    }
  }

  // ── STEP 3: Interactive Prisma Transaction ────────────────────────────────

  const runInTransaction = async (
    client: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
  ) => {
    // 3a. SELECT FOR UPDATE — đọc stock hiện tại với row-level lock
    const ingredientIds = Array.from(ingredientDemand.keys());

    const lockedIngredients = await client.$queryRawUnsafe<
      Array<{ id: string; name: string; unit: string; stock: string; minStock: string; tenantId: string }>
    >(
      `SELECT id, name, unit, stock, "minStock", "tenantId"
       FROM "Ingredient"
       WHERE id = ANY($1::text[])
       FOR UPDATE`,
      ingredientIds
    );

    // 3b. Kiểm tra đủ tồn kho — thu thập TẤT CẢ thiếu hụt
    //
    //     Nếu có branchId, ưu tiên kiểm tra BranchIngredient.stock,
    //     fallback về Ingredient.stock nếu chưa có BranchIngredient.
    const shortages: StockShortage[] = [];

    for (const ing of lockedIngredients) {
      const required = ingredientDemand.get(ing.id) ?? 0;

      let available: number;
      if (branchId) {
        const bi = await client.branchIngredient.findUnique({
          where: { branchId_ingredientId: { branchId, ingredientId: ing.id } }
        });
        available = bi ? Number(bi.stock) : Number(ing.stock);
      } else {
        available = Number(ing.stock);
      }

      if (available < required) {
        shortages.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          unit: ing.unit,
          required,
          available,
          shortage: Number((required - available).toFixed(4)),
        });
      }
    }

    if (shortages.length > 0) {
      throw new InsufficientStockError(shortages);
    }

    // 3c. UPDATE stock và INSERT InventoryLog
    const now = new Date();

    for (const ing of lockedIngredients) {
      const delta = -(ingredientDemand.get(ing.id) ?? 0);
      const consumed = Math.abs(delta);

      if (branchId) {
        // Sử dụng BranchIngredient
        const bi = await client.branchIngredient.findUnique({
          where: { branchId_ingredientId: { branchId, ingredientId: ing.id } }
        });
        if (bi) {
          const newBranchStock = Number(bi.stock) + delta;
          await client.branchIngredient.update({
            where: { id: bi.id },
            data: { stock: newBranchStock },
          });
        } else {
          await client.branchIngredient.create({
            data: {
              branchId,
              ingredientId: ing.id,
              stock: Number(ing.stock) + delta,
              lowStockThreshold: Number(ing.minStock),
            },
          });
        }
      }

      // Luôn cập nhật Ingredient stock tổng (rollup)
      const newStock = Number(ing.stock) + delta;
      await client.ingredient.update({
        where: { id: ing.id },
        data: {
          stock: newStock,
          totalExported: { increment: consumed },
        },
      });

      await client.inventoryLog.create({
        data: {
          tenantId: tenantId || ing.tenantId,
          branchId: branchId || tenantId || ing.tenantId,
          ingredientId: ing.id,
          delta,
          reason: 'ORDER_DEDUCT',
          orderId: sessionId,
          createdBy,
          createdAt: now,
        },
      });
    }
  };

  // Nếu caller đã truyền tx → dùng chung (compose pattern)
  // Nếu không → tự tạo interactive transaction mới
  if (tx) {
    await runInTransaction(tx);
  } else {
    await prisma.$transaction(runInTransaction, {
      timeout:     10_000, // 10s timeout
      maxWait:      5_000, // 5s max wait để acquire connection
    });
  }
}
