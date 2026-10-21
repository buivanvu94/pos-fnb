export interface CategoryItem {
  id: number;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface MenuItemRow {
  id: number;
  code: string;
  categoryId: number;
  categoryName: string | null;
  categoryCode: string | null;
  name: string;
  price: number;
  unit: string;
  status: "DANG_BAN" | "HET_HANG";
  imageUrl: string | null;
  targetPrinter: "KITCHEN" | "BAR";
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ToppingItem {
  id: number;
  name: string;
  price: number;
  isAvailable: boolean;
}
