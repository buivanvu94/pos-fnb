import { describe, it, expect } from "vitest";
import { formatQueueDateVietnam } from "@/server/payments/queue-number-service";

describe("Queue Number Service - Unit Tests", () => {
  it("formats date in Vietnam timezone UTC+7 correctly (YYYY-MM-DD)", () => {
    // 2026-10-21 23:00 UTC is 2026-10-22 06:00 in Vietnam
    const utcDate = new Date("2026-10-21T23:00:00.000Z");
    const formatted = formatQueueDateVietnam(utcDate);
    expect(formatted).toBe("2026-10-22");
  });

  it("formats mid-day Vietnam time accurately", () => {
    const utcDate = new Date("2026-10-22T05:30:00.000Z"); // 12:30 PM VN
    const formatted = formatQueueDateVietnam(utcDate);
    expect(formatted).toBe("2026-10-22");
  });
});
