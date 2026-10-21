import { ERROR_CATALOG } from "@/lib/error-catalog";
import { MAX_PRICE, MAX_PRICE_MESSAGE } from "./menu-schema";

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

interface RawRow {
  fields: string[];
  line: number;
}

export function parseCsvRows(text: string): { rows: RawRow[]; parseError?: CsvLineError } {
  const rows: RawRow[] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let quoteStartLine = 1;
  let currentLine = 1;
  let rowStartLine = 1;
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
        if (char === "\n") currentLine++;
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        quoteStartLine = currentLine;
        i++;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (char === "\r" || char === "\n") {
        if (char === "\r" && src[i + 1] === "\n") i++;
        currentLine++;
        currentRow.push(currentField);
        rows.push({ fields: currentRow, line: rowStartLine });
        currentRow = [];
        currentField = "";
        rowStartLine = currentLine;
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  if (inQuotes) {
    return { rows, parseError: { line: quoteStartLine, error: "Dấu ngoặc kép mở nhưng không đóng" } };
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push({ fields: currentRow, line: rowStartLine });
  }

  return { rows };
}

export function parseCsv(text: string): string[][] {
  const { rows } = parseCsvRows(text);
  return rows.map((r) => r.fields);
}

function parsePrice(raw: string): { price?: number; error?: string } {
  const s = raw.trim();
  if (!s) return { error: "Đơn giá không được để trống" };

  if (/^-?\d+$/.test(s)) {
    if (s.startsWith("-")) return { error: ERROR_CATALOG.ERR_12.message };
    const val = parseInt(s, 10);
    if (val > MAX_PRICE) return { error: MAX_PRICE_MESSAGE };
    return { price: val };
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) {
    const val = parseInt(s.replace(/[.,]/g, ""), 10);
    if (val > MAX_PRICE) return { error: MAX_PRICE_MESSAGE };
    return { price: val };
  }

  if (/^-\d{1,3}([.,]\d{3})+$/.test(s)) {
    return { error: ERROR_CATALOG.ERR_12.message };
  }

  return { error: "Đơn giá không hợp lệ (không chấp nhận số thập phân hoặc sai định dạng)" };
}

function parseStatus(raw: string): { status?: "DANG_BAN" | "HET_HANG"; error?: string } {
  const s = raw.trim();
  if (!s) return { status: "DANG_BAN" };
  const clean = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "_");
  if (clean === "dang_ban") return { status: "DANG_BAN" };
  if (clean === "het_hang") return { status: "HET_HANG" };
  return { error: "Trạng thái không hợp lệ (chỉ chấp nhận Đang bán hoặc Hết hàng)" };
}

function normalizeHeader(header: string): string {
  const clean = header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
  if (clean.includes("nhom") || clean.includes("danhmuc") || clean.includes("category")) return "category";
  if (clean.includes("ten") || clean.includes("mon") || clean.includes("name")) return "name";
  if (clean.includes("gia") || clean.includes("dongia") || clean.includes("price")) return "price";
  if (clean.includes("donvi") || clean.includes("unit") || clean.includes("dvt")) return "unit";
  if (clean.includes("trangthai") || clean.includes("status") || clean.includes("kinhdoanh")) return "status";
  return clean;
}

export function parseMenuCsv(content: string): ParseMenuCsvResult {
  const { rows, parseError } = parseCsvRows(content);
  const items: ParsedMenuItem[] = [];
  const errors: CsvLineError[] = [];

  if (parseError) errors.push(parseError);
  if (rows.length === 0) return { items, errors: [{ line: 1, error: "File CSV rỗng" }] };

  const headerRow = rows[0].fields;
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
    const { fields: row, line } = rows[r];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    const categoryName = (row[catIdx] ?? "").trim();
    const name = (row[nameIdx] ?? "").trim();
    const rawPrice = (row[priceIdx] ?? "").trim();
    const unit = unitIdx !== -1 && row[unitIdx] ? row[unitIdx].trim() : "Phần";
    const rawStatus = statusIdx !== -1 && row[statusIdx] ? row[statusIdx].trim() : "";

    if (!categoryName) {
      errors.push({ line, error: "Nhóm món không được để trống" });
      continue;
    }
    if (!name) {
      errors.push({ line, error: "Tên món không được để trống" });
      continue;
    }

    const priceResult = parsePrice(rawPrice);
    if (priceResult.error || priceResult.price === undefined) {
      errors.push({ line, error: priceResult.error || ERROR_CATALOG.ERR_12.message });
      continue;
    }

    const statusResult = parseStatus(rawStatus);
    if (statusResult.error || !statusResult.status) {
      errors.push({ line, error: statusResult.error || "Trạng thái không hợp lệ" });
      continue;
    }

    items.push({
      categoryName,
      name,
      price: priceResult.price,
      unit: unit || "Phần",
      status: statusResult.status,
      lineNumber: line,
    });
  }

  return { items, errors };
}
