export interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface MenuData {
  categories: CategoryInfo[];
  items: MenuItemForDisplay[];
}

export interface PageProps {
  params: Promise<{
    tableId: string;
  }>;
}

export interface MenuItemSoldOutState {
  id: string;
  isSoldOut: boolean;
  [key: string]: unknown;
}

export interface MenuItemForDisplay extends MenuItemSoldOutState {
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
}