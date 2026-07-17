import prisma from '../config/prisma';

export const reverseInventory = async (
  orderItemId: string,
  reversedBy?: string,
  tenantId?: string,
  branchId?: string
): Promise<Array<{ ingredientId: string; name: string; delta: number; newStock: number }>> => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
  });

  if (!orderItem) {
    throw Object.assign(new Error('OrderItem không tồn tại'), { code: 'NOT_FOUND' });
  }
  if (orderItem.status !== 'VOID') {
    throw Object.assign(new Error('Chỉ có thể hoàn kho cho item đã VOID'), { code: 'INVALID_STATUS' });
  }

  const deductLogs = await prisma.inventoryLog.findMany({
    where: {
      orderId: orderItemId,
      delta: { lt: 0 },
    },
    include: { ingredient: true },
  });

  if (deductLogs.length === 0) {
    return [];
  }

  const results: Array<{ ingredientId: string; name: string; delta: number; newStock: number }> = [];

  await prisma.$transaction(async (tx) => {
    const existingReverse = await tx.inventoryLog.findFirst({
      where: {
        orderId: orderItemId,
        reason: { startsWith: 'VOID_REVERSE' },
      },
    });

    if (existingReverse) {
      throw Object.assign(new Error('Item này đã được hoàn kho trước đó'), { code: 'ALREADY_REVERSED' });
    }

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
      const branchIng = branchId ? await tx.branchIngredient.findUnique({
        where: { branchId_ingredientId: { branchId, ingredientId } }
      }) : null;

      if (branchIng) {
        const newStock = Number(branchIng.stock) + delta;
        await tx.branchIngredient.update({
          where: { id: branchIng.id },
          data: { stock: newStock },
        });
        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { stock: { increment: delta } },
        });
        results.push({ ingredientId, name: ingredient.name, delta, newStock });
      } else {
        const currentIng = await tx.ingredient.findUnique({ where: { id: ingredientId } });
        if (!currentIng) continue;
        const newStock = Number(currentIng.stock) + delta;
        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { stock: newStock },
        });
        results.push({ ingredientId, name: ingredient.name, delta, newStock });
      }

      await tx.inventoryLog.create({
        data: {
          tenantId: tenantId || ingredient.tenantId,
          branchId: branchId || tenantId || ingredient.tenantId,
          ingredientId,
          delta,
          reason: `VOID_REVERSE: OrderItem ${orderItemId}`,
          orderId: orderItemId,
          createdBy: reversedBy ?? null,
        },
      });
    }
  });

  return results;
};

// ── Ingredient CRUD ──

export const getAll = async (lowStock?: boolean, branchId?: string) => {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { bom: true } },
      branchStocks: branchId ? {
        where: { branchId }
      } : false,
    },
  });

  const data = ingredients.map(ing => {
    const branchStock = branchId ? ing.branchStocks?.[0] : null;
    return {
      ...ing,
      stock: branchStock ? branchStock.stock : ing.stock,
      minStock: branchStock?.lowStockThreshold ?? ing.minStock,
      importPrice: branchStock?.importPrice ?? null,
      branchStockId: branchStock?.id ?? null,
    };
  });

  if (lowStock) {
    return data.filter(i => Number(i.stock) <= Number(i.minStock));
  }
  return data;
};

export const getById = async (id: string, branchId?: string) => {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id },
    include: {
      branchStocks: branchId ? {
        where: { branchId }
      } : false,
    },
  });
  if (!ingredient) return null;

  const branchStock = branchId ? ingredient.branchStocks?.[0] : null;
  return {
    ...ingredient,
    stock: branchStock ? branchStock.stock : ingredient.stock,
    minStock: branchStock?.lowStockThreshold ?? ingredient.minStock,
    importPrice: branchStock?.importPrice ?? null,
    branchStockId: branchStock?.id ?? null,
  };
};

export const create = async (data: {
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}, tenantId: string, branchId?: string) => {
  const ingredient = await prisma.ingredient.create({
    data: {
      name: data.name,
      unit: data.unit,
      stock: data.stock,
      minStock: data.minStock,
      tenantId,
    },
  });

  // Auto-create BranchIngredient for the given branch
  if (branchId) {
    await prisma.branchIngredient.create({
      data: {
        branchId,
        ingredientId: ingredient.id,
        stock: data.stock,
        lowStockThreshold: data.minStock,
      },
    });
  }

  return ingredient;
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
  await prisma.branchIngredient.deleteMany({ where: { ingredientId: id } });
  await prisma.inventoryLog.deleteMany({ where: { ingredientId: id } });
  return await prisma.ingredient.delete({ where: { id } });
};

export const adjustStock = async (
  id: string,
  delta: number,
  reason: 'MANUAL_IMPORT' | 'ADJUSTMENT' | 'MANUAL_EXPORT',
  createdBy: string,
  note?: string,
  tenantId?: string,
  branchId?: string
) => {
  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) throw new Error('Ingredient not found');

  const tid = tenantId || ingredient.tenantId;

  if (branchId) {
    // Upsert BranchIngredient
    let branchIng = await prisma.branchIngredient.findUnique({
      where: { branchId_ingredientId: { branchId, ingredientId: id } }
    });
    if (!branchIng) {
      branchIng = await prisma.branchIngredient.create({
        data: {
          branchId,
          ingredientId: id,
          stock: Number(ingredient.stock) + delta,
          lowStockThreshold: ingredient.minStock,
        },
      });
    } else {
      const newStock = Number(branchIng.stock) + delta;
      branchIng = await prisma.branchIngredient.update({
        where: { id: branchIng.id },
        data: { stock: newStock },
      });
    }

    // Update tenant-level stock as well (for rollup)
    await prisma.ingredient.update({
      where: { id },
      data: {
        stock: { increment: delta },
        ...(delta < 0 ? { totalExported: { increment: Math.abs(delta) } } : {}),
      },
    });

    const lowStockAlert = Number(branchIng.stock) <= Number(branchIng.lowStockThreshold ?? ingredient.minStock);

    await prisma.inventoryLog.create({
      data: {
        tenantId: tid,
        branchId,
        ingredientId: id,
        delta,
        reason: note ? `${reason}: ${note}` : reason,
        createdBy,
        orderId: null,
      },
    });

    return { ...ingredient, stock: branchIng.stock, lowStockAlert };
  } else {
    // Fallback: update base ingredient directly (backward compat)
    const newStock = Number(ingredient.stock) + delta;
    const updateData: any = { stock: newStock };
    if (delta < 0) {
      updateData.totalExported = { increment: Math.abs(delta) };
    }

    const [updated] = await prisma.$transaction([
      prisma.ingredient.update({
        where: { id },
        data: updateData,
      }),
      prisma.inventoryLog.create({
        data: {
          tenantId: tid,
          branchId: branchId || tid,
          ingredientId: id,
          delta,
          reason: note ? `${reason}: ${note}` : reason,
          createdBy,
          orderId: null,
        },
      }),
    ]);

    const lowStockAlert = Number(updated.stock) <= Number(updated.minStock);
    return { ...updated, lowStockAlert };
  }
};

// ── Inventory Logs ──

export const getLogs = async (
  page: number,
  limit: number,
  ingredientId?: string,
  reason?: string,
  branchId?: string
) => {
  const where: any = {};
  if (ingredientId) where.ingredientId = ingredientId;
  if (reason) where.reason = { contains: reason };
  if (branchId) where.branchId = branchId;

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

// ── BOM ──

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
