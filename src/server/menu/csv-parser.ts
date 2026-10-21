import { ERROR_CATALOG } from "@/lib/error-catalog";

export interface ParsedMenuItem {
  categoryName: string;
  name: string;
  price: number;
  unit: string;
  status: "DANG_BAN" | "HET_HANG";
  lineNumber: number;
}

export interface CsvLineError {
  line: number;
  error: string;
}

export interface ParseMenuCsvResult {
  items: ParsedMenuItem[];
  errors: CsvLineError[];
}

/**
 * Standard RFC-4180 compliant CSV parser with quote escaping support.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  while (i < src.length) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < src.length && src[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (char === "\r" || char === "\n") {
        if (char === "\r" && src[i + 1] === "\n") i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

function normalizeHeader(header: string): string {
  const clean = header.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  if (clean.includes("nhom") || clean.includes("danhmuc") || clean.includes("category")) return "category";
  if (clean.includes("ten") || clean.includes("mon") || clean.includes("name")) return "name";
  if (clean.includes("gia") || clean.includes("dongia") || clean.includes("price")) return "price";
  if (clean.includes("donvi") || clean.includes("unit") || clean.includes("dvt")) return "unit";
  if (clean.includes("trangthai") || clean.includes("status") || clean.includes("kinhdoanh")) return "status";
  return clean;
}

/**
 * Parses menu CSV content and validates each row according to BR-14, ERR-12.
 */
export function parseMenuCsv(content: string): ParseMenuCsvResult {
  const rows = parseCsv(content);
  const items: ParsedMenuItem[] = [];
  const errors: CsvLineError[] = [];

  if (rows.length === 0) {
    return { items, errors: [{ line: 1, error: "File CSV rỗng" }] };
  }

  const headerRow = rows[0];
  let catIdx = -1, nameIdx = -1, priceIdx = -1, unitIdx = -1, statusIdx = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const key = normalizeHeader(headerRow[c]);
    if (key === "category") catIdx = c;
    else if (key === "name") nameIdx = c;
    else if (key === "price") priceIdx = c;
    else if (key === "unit") unitIdx = c;
    else if (key === "status") statusIdx = c;
  }

  if (catIdx === -1 && headerRow.length >= 3) catIdx = 0;
  if (nameIdx === -1 && headerRow.length >= 3) nameIdx = 1;
  if (priceIdx === -1 && headerRow.length >= 3) priceIdx = 2;
  if (unitIdx === -1 && headerRow.length >= 4) unitIdx = 3;
  if (statusIdx === -1 && headerRow.length >= 5) statusIdx = 4;

  if (catIdx === -1 || nameIdx === -1 || priceIdx === -1) {
    errors.push({ line: 1, error: "Thiếu cột bắt buộc: nhom, ten, gia trong tiêu đề CSV" });
    return { items, errors };
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    const categoryName = (row[catIdx] ?? "").trim();
    const name = (row[nameIdx] ?? "").trim();
    const rawPrice = (row[priceIdx] ?? "").trim();
    const unit = unitIdx !== -1 && row[unitIdx] ? row[unitIdx].trim() : "Phần";
    const rawStatus = statusIdx !== -1 && row[statusIdx] ? row[statusIdx].trim() : "DANG_BAN";

    if (!categoryName) {
      errors.push({ line, error: "Nhóm món không được để trống" });
      continue;
    }
    if (!name) {
      errors.push({ line, error: "Tên món không được để trống" });
      continue;
    }

    const cleanPrice = rawPrice.replace(/[^\d-]/g, "");
    if (!cleanPrice) {
      errors.push({ line, error: "Đơn giá không được để trống" });
      continue;
    }

    const parsedPrice = parseInt(cleanPrice, 10);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      errors.push({ line, error: ERROR_CATALOG.ERR_12.message });
      continue;
    }

    const normStatus = rawStatus.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const status = normStatus.includes("het") || normStatus.includes("khong") ? "HET_HANG" : "DANG_BAN";

    items.push({ categoryName, name, price: parsedPrice, unit: unit || "Phần", status, lineNumber: line });
  }

  return { items, errors };
}
