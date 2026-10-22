import { ERROR_CATALOG } from "@/lib/error-catalog";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface DateValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * Validates fromDate and toDate query parameters.
 * Enforces BR-13 / ERR-11: fromDate must not be greater than toDate.
 */
export function validateRevenueDateRange(
  fromDate: string | null | undefined,
  toDate: string | null | undefined,
): DateValidationResult {
  if (!fromDate || !toDate) {
    return {
      valid: false,
      error: "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc (YYYY-MM-DD)",
      code: "INVALID_DATE_FORMAT",
    };
  }

  if (!DATE_REGEX.test(fromDate) || !DATE_REGEX.test(toDate)) {
    return {
      valid: false,
      error: "Định dạng ngày không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD",
      code: "INVALID_DATE_FORMAT",
    };
  }

  const fromD = new Date(`${fromDate}T00:00:00.000Z`);
  const toD = new Date(`${toDate}T00:00:00.000Z`);

  if (isNaN(fromD.getTime()) || isNaN(toD.getTime())) {
    return {
      valid: false,
      error: "Giá trị ngày tháng không hợp lệ trên lịch",
      code: "INVALID_DATE_FORMAT",
    };
  }

  // BR-13: fromDate cannot be strictly greater than toDate
  if (fromDate > toDate) {
    return {
      valid: false,
      error: ERROR_CATALOG.ERR_11.message,
      code: ERROR_CATALOG.ERR_11.id,
    };
  }

  return { valid: true };
}

/**
 * Computes exact UTC boundary Date objects for GMT+7 (Asia/Ho_Chi_Minh).
 * fromDate starts at 00:00:00.000+07:00
 * toDate ends at 23:59:59.999+07:00
 */
export function getGmt7DateBoundaries(
  fromDate: string,
  toDate: string,
): { startUtc: Date; endUtc: Date } {
  const startUtc = new Date(`${fromDate}T00:00:00.000+07:00`);
  const endUtc = new Date(`${toDate}T23:59:59.999+07:00`);
  return { startUtc, endUtc };
}
