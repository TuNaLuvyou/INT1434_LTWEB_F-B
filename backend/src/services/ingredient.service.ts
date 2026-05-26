import prisma from '../config/prisma';

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
export const reverseStockByOrderItem = async (
  orderItemId: string,
  reversedBy?: string
): Promise<Array<{ ingredientId: string; name: string; delta: number; newStock: number }>> => {
  // Lấy OrderItem + BOM của menuItem
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      menuItem: {
        include: {
          bom: {
            include: { ingredient: true },
          },
        },
      },
    },
  });

  if (!orderItem) throw Object.assign(new Error('OrderItem không tồn tại'), { code: 'NOT_FOUND' });
  if (orderItem.status !== 'VOID') throw Object.assign(new Error('Chỉ có thể hoàn kho cho item đã VOID'), { code: 'INVALID_STATUS' });

  const bom = orderItem.menuItem.bom;
  if (bom.length === 0) return []; // Không có BOM → không cần hoàn kho

  const results: Array<{ ingredientId: string; name: string; delta: number; newStock: number }> = [];

  // Thực hiện trong 1 transaction
  await prisma.$transaction(async (tx) => {
    for (const entry of bom) {
      const delta = Number(entry.quantity) * orderItem.qty; // lượng hoàn trả (dương)
      const newStock = Number(entry.ingredient.stock) + delta;

      // Cộng ngược tồn kho
      await tx.ingredient.update({
        where: { id: entry.ingredientId },
        data: { stock: newStock },
      });

      // Ghi log
      await tx.inventoryLog.create({
        data: {
          ingredientId: entry.ingredientId,
          delta,
          reason: `VOID_REVERSE: OrderItem ${orderItemId}`,
          orderId: orderItemId,
          createdBy: reversedBy ?? null,
        },
      });

      results.push({
        ingredientId: entry.ingredientId,
        name: entry.ingredient.name,
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
  reason: 'MANUAL_IMPORT' | 'ADJUSTMENT',
  createdBy: string,
  note?: string
) => {
  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) throw new Error('Ingredient not found');

  const newStock = Number(ingredient.stock) + delta;

  const [updated] = await prisma.$transaction([
    prisma.ingredient.update({
      where: { id },
      data: { stock: newStock },
    }),
    prisma.inventoryLog.create({
      data: {
        ingredientId: id,
        delta,
        reason,
        createdBy,
        orderId: null,
        ...(note && { reason: `${reason}: ${note}` }),
      },
    }),
  ]);

  const lowStockAlert = Number(updated.stock) <= Number(updated.minStock);
  return { ...updated, lowStockAlert };
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
