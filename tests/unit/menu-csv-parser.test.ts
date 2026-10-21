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
    });

    it("handles fields with commas inside double quotes", () => {
      const csv = '"Cà phê, Đặc sản",Cà phê sữa,"29,000",Ly';
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe("Cà phê, Đặc sản");
    });

    it("handles escaped double quotes inside quoted fields", () => {
      const csv = 'Cà phê,"Cà phê ""Đậm Đà"" Chồn",35000\nĂn vặt,"Khoai tây chiên ""Giòn""",40000';
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0][1]).toBe('Cà phê "Đậm Đà" Chồn');
    });

    it("handles multiline entries inside quotes", () => {
      const csv = 'Nhóm,"Món có\nxuống dòng",20000';
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0][1]).toBe("Món có\nxuống dòng");
    });
  });

  describe("parseMenuCsv business validator", () => {
    it("successfully parses valid menu items and formatted numbers", () => {
      const csv = `nhóm,tên món,đơn giá,đơn vị tính,trạng thái
Cà phê,Cà phê đen đá,25000,Ly,Đang bán
Trà sữa,Trà sữa trân châu,"35.000",Ly,Hết hàng
Nước ép,Nước cam ép,"40,000",Ly,DANG_BAN`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.items).toHaveLength(3);
      expect(result.items[0].price).toBe(25000);
      expect(result.items[1].price).toBe(35000);
      expect(result.items[2].price).toBe(40000);
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
    });

    it("rejects decimal prices and invalid format (not silently converting)", () => {
      const csv = `nhom,ten,gia
Cà phê,Cà phê 1,25000.50
Cà phê,Cà phê 2,"12,5"
Cà phê,Cà phê 3,50-60`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toContain("Đơn giá không hợp lệ");
      expect(result.errors[1].line).toBe(3);
      expect(result.errors[2].line).toBe(4);
      expect(result.items).toHaveLength(0);
    });

    it("rejects prices exceeding 2,000,000,000 cap", () => {
      const csv = `nhom,ten,gia
Đặc biệt,Rượu vang quý,3000000000`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toContain("2.000.000.000 VNĐ");
    });

    it("rejects invalid status values instead of defaulting", () => {
      const csv = `nhom,ten,gia,don vi,trang thai
Cà phê,Cà phê chồn,90000,Ly,TẠM_DỪNG`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toContain("Trạng thái không hợp lệ");
    });

    it("detects unclosed double quote and reports error on quote start line", () => {
      const csv = `nhom,ten,gia
Cà phê,"Cà phê chưa đóng ngoặc,30000`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toContain("Dấu ngoặc kép");
    });

    it("detects empty item name and empty category with line error", () => {
      const csv = `nhom,ten,gia
Cà phê,,25000
,Trà tắc,15000`;

      const result = parseMenuCsv(csv);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].error).toContain("Tên món không được để trống");
      expect(result.errors[1].line).toBe(3);
      expect(result.errors[1].error).toContain("Nhóm món không được để trống");
    });
  });
});
