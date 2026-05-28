import prisma from '../config/prisma';
import { checkAndAlertLowStock } from './low-stock.service';

// ── Inventory Reverse (Void) ──────────────────────────────────────

/**
 * Hoàn trả tồn kho nguyên liệu khi một OrderItem bị void.
 *
 * Luồng:
 *  1. Tìm OrderItem + menuItem.bom (danh sách nguyên liệu + định mức)
 *  2. Tính lượng hoàn trả: bom.quantity × orderItem.qty
 *  3. Cộng ngược tồn kho cho từng nguyên liệu trong BOM
 *  4. Ghi InventoryLog với reason='VOID_REVERSE' và orderId=orderItemId
 *  5. Thực hiện trong transaction để đảm bảo atomicity
 *
 * @returns danh sách { ingredientId, name, delta, newStock } đã hoàn trả
 */
export const reverseInventory = async (
  orderItemId: string,
  reversedBy?: string
): Promise<Array<{ ingredientId: string; name: string; delta: number; newStock: number }>> => {
  // 1. Kiểm tra OrderItem có tồn tại và đã ở trạng thái VOID chưa
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
  });

  if (!orderItem) {
    throw Object.assign(new Error('OrderItem không tồn tại'), { code: 'NOT_FOUND' });
  }
  if (orderItem.status !== 'VOID') {
    throw Object.assign(new Error('Chỉ có thể hoàn kho cho item đã VOID'), { code: 'INVALID_STATUS' });
  }

  // 2. Tìm các InventoryLog đã trừ kho cho orderItemId này (delta < 0)
  const deductLogs = await prisma.inventoryLog.findMany({
    where: {
      orderId: orderItemId,
      delta: { lt: 0 },
    },
    include: { ingredient: true },
  });

  if (deductLogs.length === 0) {
    return []; // Không có log trừ kho → không có gì để hoàn
  }

  const results: Array<{ ingredientId: string; name: string; delta: number; newStock: number }> = [];

  // 3. Thực hiện hoàn kho trong transaction
  await prisma.$transaction(async (tx) => {
    // Kiểm tra xem đã hoàn kho cho orderItemId này chưa để tránh hoàn trùng lặp
    const existingReverse = await tx.inventoryLog.findFirst({
      where: {
        orderId: orderItemId,
        reason: { startsWith: 'VOID_REVERSE' },
      },
    });

    if (existingReverse) {
      throw Object.assign(new Error('Item này đã được hoàn kho trước đó'), { code: 'ALREADY_REVERSED' });
    }

    // Gộp delta nếu có nhiều log cho cùng 1 nguyên liệu
    const refundMap = new Map<string, { delta: number; ingredient: any }>();
    for (const log of deductLogs) {
      const current = refundMap.get(log.ingredientId);
      const refundAmount = Math.abs(Number(log.delta));
      if (current) {
        current.delta += refundAmount;
      } else {
        refundMap.set(log.ingredientId, { delta: refundAmount, ingredient: log.ingredient });
      }
    }

    for (const [ingredientId, { delta, ingredient }] of refundMap.entries()) {
      // Lấy tồn kho mới nhất
      const currentIng = await tx.ingredient.findUnique({ where: { id: ingredientId } });
      if (!currentIng) continue;

      const newStock = Number(currentIng.stock) + delta;

      // Cộng ngược tồn kho
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { stock: newStock },
      });

      // Ghi log hoàn kho
      await tx.inventoryLog.create({
        data: {
          ingredientId,
          delta,
          reason: `VOID_REVERSE: OrderItem ${orderItemId}`,
          orderId: orderItemId,
          createdBy: reversedBy ?? null,
        },
      });

      results.push({
        ingredientId,
        name: ingredient.name,
        delta,
        newStock,
      });
    }
  });

  return results;
};

// ── Ingredient CRUD ──────────────────────────────────────────────

export const getAll = async (lowStock?: boolean) => {
  const all = await prisma.ingredient.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { bom: true } } },
  });

  if (lowStock) {
    return all.filter(i => Number(i.stock) <= Number(i.minStock));
  }
  return all;
};

export const getById = async (id: string) => {
  return await prisma.ingredient.findUnique({ where: { id } });
};

export const create = async (data: {
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}) => {
  return await prisma.ingredient.create({ data });
};

export const update = async (id: string, data: {
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}) => {
  return await prisma.ingredient.update({ where: { id }, data });
};

export const remove = async (id: string) => {
  const bomCount = await prisma.bOM.count({ where: { ingredientId: id } });
  if (bomCount > 0) {
    throw { code: 'BOM_CONFLICT', count: bomCount };
  }
  // Xóa log trước rồi mới xóa ingredient
  await prisma.inventoryLog.deleteMany({ where: { ingredientId: id } });
  return await prisma.ingredient.delete({ where: { id } });
};

export const adjustStock = async (
  id: string,
  delta: number,
  reason: 'MANUAL_IMPORT' | 'ADJUSTMENT' | 'WASTE',
  createdBy: string,
  note?: string
) => {
  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) throw new Error('Ingredient not found');

  const newStock = Number(ingredient.stock) + delta;

  // WASTE không được khiến stock âm
  if (reason === 'WASTE' && newStock < 0) {
    throw Object.assign(
      new Error(`Số lượng xuất hủy (${Math.abs(delta)}) vượt quá tồn kho hiện tại (${Number(ingredient.stock)})`),
      { code: 'STOCK_UNDERFLOW' }
    );
  }

  const reasonLabel = note ? `${reason}: ${note}` : reason;

  const [updated] = await prisma.$transaction([
    prisma.ingredient.update({
      where: { id },
      data:  { stock: newStock },
    }),
    prisma.inventoryLog.create({
      data: {
        ingredientId: id,
        delta,
        reason:    reasonLabel,
        createdBy,
        orderId:   null,
      },
    }),
  ]);

  const lowStockAlert = Number(updated.stock) <= Number(updated.minStock);

  // Kiểm tra và gửi email cảnh báo nếu tồn kho thấp (fire-and-forget)
  if (lowStockAlert) {
    checkAndAlertLowStock([id], reason).catch(() => {});
  }

  return { ...updated, lowStockAlert };
};

// ── Waste Entry (Xuất hủy) ───────────────────────────────────────
//
// Xuất hủy là nghiệp vụ ghi nhận nguyên liệu bị loại bỏ (hết hạn, hư hỏng,
// nhiễm bẩn, v.v.) mà KHÔNG liên quan đến OrderItem hay BOM.
// Khác biệt so với ADJUSTMENT:
//  - WASTE: luôn là delta âm, bắt buộc có reason cụ thể (hư hỏng, hết hạn...)
//  - ADJUSTMENT: có thể dương/âm, dùng khi kiểm kho phát hiện lệch số
//
// Dữ liệu trả về:
//  { ingredient (trạng thái mới), log (record vừa tạo), lowStockAlert }

export type WasteReason =
  | 'EXPIRED'       // Hết hạn sử dụng
  | 'DAMAGED'       // Hư hỏng vật lý (vỡ, dập nát)
  | 'CONTAMINATED'  // Nhiễm bẩn, không đạt vệ sinh
  | 'OVERCOOKED'    // Nấu hỏng / lỗi chế biến
  | 'SPILLED'       // Đổ vỡ, rò rỉ
  | 'OTHER';        // Lý do khác (bắt buộc đi kèm note)

export interface WasteEntryInput {
  ingredientId: string;
  quantity:     number;       // luôn dương — service sẽ tự đổi dấu
  wasteReason:  WasteReason;
  note?:        string;       // bắt buộc khi wasteReason = 'OTHER'
  performedBy:  string;       // userId của người thực hiện
}

export interface WasteEntryResult {
  log:           any;     // InventoryLog record vừa tạo
  ingredient:    any;     // Ingredient với stock đã cập nhật
  lowStockAlert: boolean;
}

export const recordWaste = async (input: WasteEntryInput): Promise<WasteEntryResult> => {
  const { ingredientId, quantity, wasteReason, note, performedBy } = input;

  // Bắt buộc có note khi chọn 'OTHER'
  if (wasteReason === 'OTHER' && (!note || note.trim() === '')) {
    throw Object.assign(
      new Error('Lý do "OTHER" yêu cầu mô tả cụ thể trong trường note'),
      { code: 'NOTE_REQUIRED' }
    );
  }

  // Lấy ingredient hiện tại (validation + đọc stock)
  const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
  if (!ingredient) {
    throw Object.assign(new Error('Nguyên liệu không tồn tại'), { code: 'NOT_FOUND' });
  }

  // delta luôn âm (trừ kho)
  const delta    = -Math.abs(quantity);
  const newStock = Number(ingredient.stock) + delta;

  if (newStock < 0) {
    throw Object.assign(
      new Error(
        `Số lượng xuất hủy (${quantity} ${ingredient.unit}) vượt quá tồn kho hiện tại ` +
        `(${Number(ingredient.stock)} ${ingredient.unit})`
      ),
      { code: 'STOCK_UNDERFLOW' }
    );
  }

  // Label ghi vào InventoryLog: 'WASTE:<REASON> [note nếu có]'
  const reasonLabel = note?.trim()
    ? `WASTE:${wasteReason} — ${note.trim()}`
    : `WASTE:${wasteReason}`;

  // Thực hiện UPDATE + INSERT trong 1 transaction
  let createdLog: any;
  const [updatedIngredient] = await prisma.$transaction([
    prisma.ingredient.update({
      where: { id: ingredientId },
      data:  { stock: newStock },
    }),
    prisma.inventoryLog.create({
      data: {
        ingredientId,
        delta,
        reason:    reasonLabel,
        orderId:   null,
        createdBy: performedBy,
      },
    }),
  ]);

  // Lấy log vừa tạo để trả về (prisma.$transaction sequential không return create)
  createdLog = await prisma.inventoryLog.findFirst({
    where: { ingredientId, createdBy: performedBy },
    orderBy: { createdAt: 'desc' },
    include: { ingredient: { select: { name: true, unit: true } } },
  });

  const lowStockAlert = Number(updatedIngredient.stock) <= Number(updatedIngredient.minStock);

  return {
    log:           createdLog,
    ingredient:    updatedIngredient,
    lowStockAlert,
  };
};

// ── Inventory Logs ───────────────────────────────────────────────

export const getLogs = async (
  page: number,
  limit: number,
  ingredientId?: string,
  reason?: string
) => {
  const where: any = {};
  if (ingredientId) where.ingredientId = ingredientId;
  if (reason) where.reason = { contains: reason };

  const [total, logs] = await prisma.$transaction([
    prisma.inventoryLog.count({ where }),
    prisma.inventoryLog.findMany({
      where,
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// ── BOM ──────────────────────────────────────────────────────────

export const getBom = async (menuItemId: string) => {
  return await prisma.bOM.findMany({
    where: { menuItemId },
    include: { ingredient: true },
    orderBy: { ingredient: { name: 'asc' } },
  });
};

export const addBomEntry = async (
  menuItemId: string,
  ingredientId: string,
  quantity: number
) => {
  // Verify ingredient exists
  const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
  if (!ing) throw { code: 'NOT_FOUND', entity: 'Ingredient' };

  return await prisma.bOM.create({
    data: { menuItemId, ingredientId, quantity },
    include: { ingredient: true },
  });
};

export const updateBomEntry = async (
  menuItemId: string,
  ingredientId: string,
  quantity: number
) => {
  return await prisma.bOM.update({
    where: { menuItemId_ingredientId: { menuItemId, ingredientId } },
    data: { quantity },
    include: { ingredient: true },
  });
};

export const deleteBomEntry = async (menuItemId: string, ingredientId: string) => {
  return await prisma.bOM.delete({
    where: { menuItemId_ingredientId: { menuItemId, ingredientId } },
  });
};
