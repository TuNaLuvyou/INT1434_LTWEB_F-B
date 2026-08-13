import { MenuItem } from '@prisma/client';
import prisma from '../config/prisma';
import { TranslateService } from './translate.service';

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
}

interface MenuItemWithCategoryInfo extends MenuItem {
  category: CategoryInfo;
}

interface BrandingData {
  displayName?: string | null;
  foodType?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
}

export interface TableInfo {
  id: string;
  tableNumber: number;
  label: string;
}

export interface MenuData {
  categories: CategoryInfo[];
  items: MenuItemWithCategoryInfo[];
  branding: BrandingData | null;
  branchName: string | null;
  tableInfo: TableInfo | null;
}

export class MenuService {
  static async getMenu(tenantId: string, branchId?: string, categoryId?: string, soldOut?: string, tableId?: string): Promise<MenuData | null> {
    if (categoryId) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: categoryId }
      });
      if (!categoryExists) return null;
    }

    const where: any = { isActive: true, tenantId, isAvailableOnQr: true };
    if (categoryId) where.categoryId = categoryId;
    if (soldOut !== undefined) where.isSoldOut = soldOut === 'true';

    const items = await prisma.menuItem.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, slug: true, sortOrder: true }
        }
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { name: 'asc' }
      ]
    });

    // BranchMenuItem overrides
    let branchOverrides: Map<string, { price?: any; isSoldOut?: boolean }> | null = null;
    let branchCategoryMap: Map<string, { isEnabled: boolean; sortOrder: number }> | null = null;

    if (branchId) {
      const overrides = await prisma.branchMenuItem.findMany({
        where: { branchId, menuItemId: { in: items.map(i => i.id) } }
      });
      branchOverrides = new Map(overrides.map(o => [o.menuItemId, { price: o.price, isSoldOut: o.isSoldOut ?? undefined }]));

      const catOverrides = await prisma.branchCategory.findMany({
        where: { branchId, categoryId: { in: [...new Set(items.map(i => i.categoryId))] } }
      });
      branchCategoryMap = new Map(catOverrides.map(c => [c.categoryId, { isEnabled: c.isEnabled, sortOrder: c.sortOrder }]));
    }

    const filteredItems = items.filter(item => {
      if (!branchCategoryMap) return true;
      const bc = branchCategoryMap.get(item.categoryId);
      if (bc && !bc.isEnabled) return false;
      return true;
    });

    const categoryMap = new Map<string, CategoryInfo>();
    filteredItems.forEach(item => {
      if (!categoryMap.has(item.categoryId)) {
        let sortOrder = item.category.sortOrder;
        if (branchCategoryMap) {
          const bc = branchCategoryMap.get(item.categoryId);
          if (bc) sortOrder = bc.sortOrder;
        }
        categoryMap.set(item.categoryId, {
          id: item.category.id,
          name: item.category.name,
          slug: item.category.slug,
          sortOrder
        });
      }
    });

    const formattedItems = filteredItems.map((item): MenuItemWithCategoryInfo => {
      const { category, ...rest } = item;
      const override = branchOverrides?.get(item.id);
      const finalPrice = override?.price ?? item.price;
      const finalIsSoldOut = override?.isSoldOut ?? item.isSoldOut;
      return {
        ...rest,
        price: finalPrice,
        isSoldOut: finalIsSoldOut,
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug
        }
      };
    });

    // Auto-translate items without englishName (fire & forget)
    for (const item of formattedItems) {
      if (!item.englishName) {
        TranslateService.autoTranslateMenuItem(item.id).catch(() => {});
      }
    }

    const sortedCategories = Array.from(categoryMap.values()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    // Lấy branding của tenant
    const rawBranding = await prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: {
        displayName: true,
        foodType: true,
        primaryColor: true,
        secondaryColor: true,
        logoUrl: true,
      },
    });

    const branding: BrandingData | null = rawBranding
      ? {
          displayName: rawBranding.displayName,
          foodType: rawBranding.foodType,
          primaryColor: rawBranding.primaryColor,
          secondaryColor: rawBranding.secondaryColor,
          logoUrl: rawBranding.logoUrl,
        }
      : null;

    const branch = branchId
      ? await prisma.branch.findFirst({
          where: { id: branchId, tenantId, isActive: true },
          select: { name: true },
        })
      : null;

    let tableInfo: TableInfo | null = null;
    if (tableId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, tenantId },
        select: { id: true, tableNumber: true, label: true },
      });
      if (table) {
        tableInfo = {
          id: table.id,
          tableNumber: table.tableNumber,
          label: table.label,
        };
      }
    }

    return {
      categories: sortedCategories,
      items: formattedItems,
      branding,
      branchName: branch?.name ?? null,
      tableInfo,
    };
  }
}
