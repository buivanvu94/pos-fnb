import { describe, it, expect } from "vitest";
import {
  validateRevenueDateRange,
  getGmt7DateBoundaries,
} from "@/server/reports/report-date-helper";
import { ERROR_CATALOG } from "@/lib/error-catalog";

describe("Revenue Report Date & Timezone Handling (AC-11-2, BR-13, GMT+7)", () => {
  it("AC-11-2: rejects fromDate > toDate with verbatim ERR-11", () => {
    const result = validateRevenueDateRange("2026-10-25", "2026-10-20");
    expect(result.valid).toBe(false);
    expect(result.code).toBe(ERROR_CATALOG.ERR_11.id);
    expect(result.error).toBe(ERROR_CATALOG.ERR_11.message);
    expect(result.error).toBe("Ngày bắt đầu không được lớn hơn ngày kết thúc!");
  });

  it("accepts valid date range when fromDate <= toDate", () => {
    const sameDay = validateRevenueDateRange("2026-10-22", "2026-10-22");
    expect(sameDay.valid).toBe(true);

    const multiDay = validateRevenueDateRange("2026-10-20", "2026-10-25");
    expect(multiDay.valid).toBe(true);
  });

  it("rejects invalid date format or missing params", () => {
    expect(validateRevenueDateRange("", "2026-10-22").valid).toBe(false);
    expect(validateRevenueDateRange("invalid", "2026-10-22").valid).toBe(false);
    expect(validateRevenueDateRange("2026/10/20", "2026/10/22").valid).toBe(false);
  });

  it("calculates GMT+7 boundaries: 23:59 and 00:01 fall into correct date", () => {
    const targetDate = "2026-10-22";
    const { startUtc, endUtc } = getGmt7DateBoundaries(targetDate, targetDate);

    // 00:00:00 GMT+7 is 17:00:00 UTC previous day
    expect(startUtc.toISOString()).toBe("2026-10-21T17:00:00.000Z");
    // 23:59:59.999 GMT+7 is 16:59:59.999 UTC same day
    expect(endUtc.toISOString()).toBe("2026-10-22T16:59:59.999Z");

    // Order at 00:01 GMT+7 on 2026-10-22
    const orderAt0001 = new Date("2026-10-22T00:01:00.000+07:00");
    expect(orderAt0001.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
    expect(orderAt0001.getTime()).toBeLessThanOrEqual(endUtc.getTime());

    // Order at 23:59 GMT+7 on 2026-10-22
    const orderAt2359 = new Date("2026-10-22T23:59:00.000+07:00");
    expect(orderAt2359.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
    expect(orderAt2359.getTime()).toBeLessThanOrEqual(endUtc.getTime());

    // Order at 23:59 GMT+7 on previous day (2026-10-21) -> excluded
    const prevDayOrder = new Date("2026-10-21T23:59:00.000+07:00");
    expect(prevDayOrder.getTime()).toBeLessThan(startUtc.getTime());

    // Order at 00:01 GMT+7 on next day (2026-10-23) -> excluded
    const nextDayOrder = new Date("2026-10-23T00:01:00.000+07:00");
    expect(nextDayOrder.getTime()).toBeGreaterThan(endUtc.getTime());
  });
});
