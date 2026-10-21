import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { getPrinterSettings, savePrinterSettings } from "@/server/printing/settings-service";
import { renderPayloadToCanvas } from "@/server/printing/render-engine";

describe("Multi-layer defense for store logo (Point 6)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(() => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(schema.settings).where(eq(schema.settings.key, "store.logo"));
    }
    await pool.end();
  });

  it("getPrinterSettings discards invalid logo filename and returns empty string without throwing", async () => {
    // Malicious traversal filename directly in database
    await db
      .insert(schema.settings)
      .values({ key: "store.logo", value: "../../../etc/passwd", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: "../../../etc/passwd", updatedAt: new Date() },
      });

    const settings = await getPrinterSettings();
    expect(settings.storeLogo).toBe("");
  });

  it("renderPayloadToCanvas ignores invalid logo in payload without throwing", async () => {
    const maliciousPayload = {
      kind: "FINAL_RECEIPT",
      orderCode: "HD-SEC-01",
      tableName: "Bàn 1",
      createdAt: new Date().toISOString(),
      items: [{ name: "Trà đào", quantity: 1, unitPrice: 30000, amount: 30000 }],
      totalAmount: 30000,
      finalAmount: 30000,
      storeLogo: "../../secret/credentials.txt",
    };

    // Must render successfully without throwing path traversal or file not found errors
    const canvas = await renderPayloadToCanvas(maliciousPayload, 80);
    expect(canvas).toBeDefined();
    expect(canvas.width).toBeGreaterThan(0);
  });
});
