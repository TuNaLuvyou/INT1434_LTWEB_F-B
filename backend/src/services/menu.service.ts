import { MenuItem } from '@prisma/client';
import prisma from '../config/prisma';

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
}

export interface MenuItemWithCategoryInfo extends MenuItem {
  category: CategoryInfo;
}

export interface MenuData {
  categories: CategoryInfo[];
  items: MenuItemWithCategoryInfo[];
}

export class MenuService {
  /**
   * Fetches the menu items based on active status, category, and soldOut status.
   * @param tenantId Tenant ID to filter by
   * @param branchId Optional branch ID to filter by
   * @param categoryId Optional category ID to filter by
   * @param soldOut Optional sold out status to filter by ('true' | 'false')
   * @returns MenuData containing filtered categories and items, or null if category is not found
   */
  static async getMenu(tenantId: string, branchId?: string, categoryId?: string, soldOut?: string): Promise<MenuData | null> {
    // 1. Validate categoryId if provided
    if (categoryId) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: categoryId }
      });
      
      if (!categoryExists) {
        return null; // Return null to let the controller handle the 404
      }
    }

    // 2. Build where clause
    const where: any = { isActive: true, tenantId };
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (soldOut !== undefined) {
      where.isSoldOut = soldOut === 'true';
    }

    // 3. Query items with category info included, sorted correctly
    const items = await prisma.menuItem.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            sortOrder: true
          }
        }
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { name: 'asc' }
      ]
    });

    // 4. Extract unique categories that have active items
    const categoryMap = new Map<string, CategoryInfo>();
    items.forEach(item => {
      if (!categoryMap.has(item.categoryId)) {
        categoryMap.set(item.categoryId, {
          id: item.category.id,
          name: item.category.name,
          slug: item.category.slug
        });
      }
    });

    // 5. Format items to match the exact CategoryInfo structure in the response
    const formattedItems = items.map((item): MenuItemWithCategoryInfo => {
      const { category, ...rest } = item;
      return {
        ...rest,
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug
        }
      };
    });

    return {
      categories: Array.from(categoryMap.values()),
      items: formattedItems
    };
  }
}
