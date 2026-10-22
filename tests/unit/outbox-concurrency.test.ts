import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { enqueueOutboxItem, processOutbox } from "@/server/outbox/outbox-service";
import { sendTelegramNotification } from "@/server/outbox/telegram-sender";
import type { ShiftCloseTelegramPayload } from "@/server/outbox/outbox-types";

describe("Outbox Concurrency & Telegram Plaintext Format Tests", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let mockServer: http.Server;
  let mockPort: number;
  let receivedRequests: any[] = [];

  const fakeBotToken = "888888888:AAFakeConcurrencyTestToken";
  const fakeChatId = "-1001122334455";

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    await new Promise<void>((resolve) => {
      mockServer = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          receivedRequests.push({
            method: req.method,
            url: req.url,
            body: body ? JSON.parse(body) : null,
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, result: { message_id: 999 } }));
        });
      });
      mockServer.listen(0, "127.0.0.1", () => {
        const addr = mockServer.address() as any;
        mockPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    mockServer.close();
    await pool.end();
  });

  it("handles special characters (*, _, [) cleanly in plaintext Telegram message", async () => {
    receivedRequests = [];

    const specialPayload: ShiftCloseTelegramPayload = {
      shiftId: 101,
      shiftCode: "CA_TEST*SPECIAL_[01]",
      cashierName: "Nguyễn Văn _A_ *Thu Ngân* [Ca 1]",
      openedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      initialCash: 1_000_000,
      cashSales: 1_000_000,
      vietqrSales: 0,
      totalSales: 1_000_000,
      cashIn: 0,
      cashOut: 0,
      expectedCash: 2_000_000,
      actualCash: 2_000_000,
      difference: 0,
      explanation: "Lệch tiền: *khách tip* _thêm_ [50k]",
      invoiceCount: 2,
    };

    const res = await sendTelegramNotification(specialPayload, {
      apiBaseUrl: `http://127.0.0.1:${mockPort}`,
      botToken: fakeBotToken,
      chatId: fakeChatId,
    });

    expect(res.ok).toBe(true);
    expect(receivedRequests).toHaveLength(1);
    // Plain text message body does not specify parse_mode: Markdown
    expect(receivedRequests[0].body.parse_mode).toBeUndefined();
    expect(receivedRequests[0].body.text).toContain("CA_TEST*SPECIAL_[01]");
    expect(receivedRequests[0].body.text).toContain("Nguyễn Văn _A_ *Thu Ngân* [Ca 1]");
    expect(receivedRequests[0].body.text).toContain("Lệch tiền: *khách tip* _thêm_ [50k]");
  });

  it("guarantees two parallel processOutbox runs claim each item exactly once without duplicates", async () => {
    await db.delete(schema.outbox);
    receivedRequests = [];

    const uniqueKey = `concurrency_test_${Date.now()}`;
    const payload: ShiftCloseTelegramPayload = {
      shiftId: 202,
      shiftCode: "CA-CONCURRENCY",
      cashierName: "Thu Ngan Concurrency",
      openedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      initialCash: 500_000,
      cashSales: 500_000,
      vietqrSales: 0,
      totalSales: 500_000,
      cashIn: 0,
      cashOut: 0,
      expectedCash: 1_000_000,
      actualCash: 1_000_000,
      difference: 0,
      invoiceCount: 1,
    };

    const item = await enqueueOutboxItem("TELEGRAM_SHIFT_CLOSE", payload, uniqueKey, db);
    expect(item).not.toBeNull();

    // Run two processOutbox concurrently
    const [res1, res2] = await Promise.all([
      processOutbox({
        apiBaseUrl: `http://127.0.0.1:${mockPort}`,
        botToken: fakeBotToken,
        chatId: fakeChatId,
      }),
      processOutbox({
        apiBaseUrl: `http://127.0.0.1:${mockPort}`,
        botToken: fakeBotToken,
        chatId: fakeChatId,
      }),
    ]);

    // Total sent across both runs for this item must be exactly 1
    const totalSent = res1.sent + res2.sent;
    expect(totalSent).toBe(1);

    // Verify received requests on the mock server
    const matchingReqs = receivedRequests.filter((r) =>
      r.body?.text?.includes("CA-CONCURRENCY"),
    );
    expect(matchingReqs).toHaveLength(1);

    const [dbItem] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(dbItem.status).toBe("SENT");
  });
});
