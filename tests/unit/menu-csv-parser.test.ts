import { describe, it, expect } from "vitest";
import { parseCsv, parseMenuCsv } from "@/server/menu/csv-parser";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Menu CSV Parser Unit Tests", () => {
  describe("parseCsv low-level parser", () => {
    it("parses standard comma-separated lines", () => {
      const csv = "Cà phê,Cà phê đen,25000,Ly,DANG_BAN\nTrà,Trà đào,30000,Ly,DANG_BAN";
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(["Cà phê", "Cà phê đen", "25000", "Ly", "DANG_BAN"]);
      expect(rows[1]).toEqual(["Trà", "Trà đào", "30000", "Ly", "DANG_BAN"]);
    });

    it("handles fields with commas inside double quotes", () => {
      const csv = '"Cà phê, Đặc sản",Cà phê sữa,"29,000",Ly';
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe("Cà phê, Đặc sản");
      expect(rows[0][1]).toBe("Cà phê sữa");
    });

    it("handles escaped double quotes inside quoted fields", () => {
      const csv = 'Cà phê,"Cà phê ""Đậm Đà"" Chồn",35000\nĂn vặt,"Khoai tây chiên ""Giòn""",40000';
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0][1]).toBe('Cà phê "Đậm Đà" Chồn');
      expect(rows[1][1]).toBe('Khoai tây chiên "Giòn"');
    });

    it("handles multiline entries inside quotes", () => {
      const csv = 'Nhóm,"Món có\nxuống dòng",20000';
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0][1]).toBe("Món có\nxuống dòng");
    });
  });

  describe("parseMenuCsv business validator", () => {
    it("successfully parses valid menu items", () => {
      const csv = `nhóm,tên món,đơn giá,đơn vị tính,trạng thái
Cà phê,Cà phê đen đá,25000,Ly,Đang bán
Trà sữa,Trà sữa trân châu,35000,Ly,Hết hàng`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.items).toHaveLength(2);

      expect(result.items[0]).toMatchObject({
        categoryName: "Cà phê",
        name: "Cà phê đen đá",
        price: 25000,
        unit: "Ly",
        status: "DANG_BAN",
        lineNumber: 2,
      });

      expect(result.items[1]).toMatchObject({
        categoryName: "Trà sữa",
        name: "Trà sữa trân châu",
        price: 35000,
        unit: "Ly",
        status: "HET_HANG",
        lineNumber: 3,
      });
    });

    it("detects negative price and reports exact ERR-12 error with line number", () => {
      const csv = `nhom,ten,gia,don vi
Cà phê,Cà phê sữa,-10000,Ly
Trà,Trà vải,30000,Ly`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toBe(ERROR_CATALOG.ERR_12.message);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Trà vải");
    });

    it("detects empty item name and reports line error", () => {
      const csv = `nhom,ten,gia
Cà phê,,25000
Trà,Trà tắc,15000`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toContain("Tên món không được để trống");
      expect(result.items).toHaveLength(1);
    });

    it("detects empty category and reports line error", () => {
      const csv = `nhom,ten,gia
,Cà phê muối,32000`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toContain("Nhóm món không được để trống");
    });

    it("detects missing required columns in header", () => {
      const csv = `mo_ta,so_luong
Mo ta mon,10`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(1);
      expect(result.items).toHaveLength(0);
    });
  });
});
