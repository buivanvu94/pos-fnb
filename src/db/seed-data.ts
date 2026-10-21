import type { NewArea, NewCategory } from "./schema";

export interface SampleMenuItemInput {
  code: string;
  name: string;
  categoryCode: string;
  price: number;
  unit: string;
  status: "DANG_BAN" | "HET_HANG";
  targetPrinter: "KITCHEN" | "BAR";
}

export interface SampleTableInput {
  code: string;
  name: string;
  areaCode: string;
  capacity: number;
  status: "TRONG" | "DANG_DUNG" | "CHO_THANH_TOAN";
}

export const initialAreas: NewArea[] = [
  { code: "KV-T1", name: "Tầng 1 (Trong nhà)", displayOrder: 1 },
  { code: "KV-T2", name: "Tầng 2 (Máy lạnh)", displayOrder: 2 },
  { code: "KV-SV", name: "Sân vườn", displayOrder: 3 },
];

export const initialTableTemplates: SampleTableInput[] = [
  { code: "BAN-01", name: "Bàn 01", areaCode: "KV-T1", capacity: 4, status: "TRONG" },
  { code: "BAN-02", name: "Bàn 02", areaCode: "KV-T1", capacity: 4, status: "TRONG" },
  { code: "BAN-03", name: "Bàn 03", areaCode: "KV-T1", capacity: 4, status: "TRONG" },
  { code: "BAN-04", name: "Bàn 04", areaCode: "KV-T1", capacity: 4, status: "TRONG" },
  { code: "BAN-05", name: "Bàn 05", areaCode: "KV-T2", capacity: 4, status: "TRONG" },
  { code: "BAN-06", name: "Bàn 06", areaCode: "KV-T2", capacity: 6, status: "TRONG" },
  { code: "BAN-07", name: "Bàn 07", areaCode: "KV-T2", capacity: 6, status: "TRONG" },
  { code: "BAN-08", name: "Bàn 08", areaCode: "KV-SV", capacity: 8, status: "TRONG" },
];

export const initialCategories: NewCategory[] = [
  { code: "CAT-CF", name: "Cà phê", displayOrder: 1 },
  { code: "CAT-TRA", name: "Trà & Trà sữa", displayOrder: 2 },
  { code: "CAT-AN", name: "Món ăn nhẹ", displayOrder: 3 },
];

export const initialMenuItemTemplates: SampleMenuItemInput[] = [
  {
    code: "CF-DEN",
    name: "Cà phê đen đá",
    categoryCode: "CAT-CF",
    price: 25000,
    unit: "Ly",
    status: "DANG_BAN",
    targetPrinter: "BAR",
  },
  {
    code: "CF-SUA",
    name: "Cà phê sữa đá",
    categoryCode: "CAT-CF",
    price: 29000,
    unit: "Ly",
    status: "DANG_BAN",
    targetPrinter: "BAR",
  },
  {
    code: "TRA-DAO",
    name: "Trà đào cam sả",
    categoryCode: "CAT-TRA",
    price: 35000,
    unit: "Ly",
    status: "DANG_BAN",
    targetPrinter: "BAR",
  },
  {
    code: "BANH-MI",
    name: "Bánh mì chảo",
    categoryCode: "CAT-AN",
    price: 45000,
    unit: "Phần",
    status: "DANG_BAN",
    targetPrinter: "KITCHEN",
  },
];

export const initialSettings = [
  { key: "STORE_NAME", value: "POS F&B Quán Việt", description: "Tên quán hiển thị" },
  { key: "STORE_ADDRESS", value: "123 Đường Ẩm Thực, Quận 1, TP. HCM", description: "Địa chỉ quán" },
  { key: "STORE_PHONE", value: "0901234567", description: "Số điện thoại hotline" },
];
