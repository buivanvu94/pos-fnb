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

describe("Outbox Queue & Telegram Service (US-10, DEC-14)", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let mockServer: http.Server;
  let mockPort: number;
  let mockStatusCode = 200;
  let mockResponseBody: any = { ok: true };
  let receivedRequests: any[] = [];

  const fakeBotToken = "999999999:AAFakeTokenForTestPurposeOnly";
  const fakeChatId = "-100987654321";

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
          res.writeHead(mockStatusCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify(mockResponseBody));
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

  const samplePayload: ShiftCloseTelegramPayload = {
    shiftId: 999,
    shiftCode: "CA-TEST-01",
    cashierName: "Nguyễn Thu Ngân",
    openedAt: new Date().toISOString(),
    closedAt: new Date().toISOString(),
    initialCash: 1_000_000,
    cashSales: 2_500_000,
    vietqrSales: 1_000_000,
    totalSales: 3_500_000,
    cashIn: 0,
    cashOut: 0,
    expectedCash: 3_500_000,
    actualCash: 3_500_000,
    difference: 0,
    invoiceCount: 15,
  };

  it("sends Telegram notification successfully via mock server", async () => {
    mockStatusCode = 200;
    mockResponseBody = { ok: true, result: { message_id: 123 } };
    receivedRequests = [];

    const res = await sendTelegramNotification(samplePayload, {
      apiBaseUrl: `http://127.0.0.1:${mockPort}`,
      botToken: fakeBotToken,
      chatId: fakeChatId,
    });

    expect(res.ok).toBe(true);
    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0].url).toContain(`/bot${fakeBotToken}/sendMessage`);
    expect(receivedRequests[0].body.chat_id).toBe(fakeChatId);
    expect(receivedRequests[0].body.text).toContain("BÁO CÁO KẾT CA: CA-TEST-01");
  });

  it("never leaks bot token when Telegram API fails", async () => {
    mockStatusCode = 401;
    mockResponseBody = { ok: false, description: `Unauthorized for token ${fakeBotToken}` };

    const res = await sendTelegramNotification(samplePayload, {
      apiBaseUrl: `http://127.0.0.1:${mockPort}`,
      botToken: fakeBotToken,
      chatId: fakeChatId,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error).not.toContain(fakeBotToken);
  });

  it("processes outbox queue: marks SENT when delivery succeeds", async () => {
    mockStatusCode = 200;
    mockResponseBody = { ok: true };

    const key = `test_success_${Date.now()}`;
    const item = await enqueueOutboxItem("TELEGRAM_SHIFT_CLOSE", samplePayload, key, db);
    expect(item).not.toBeNull();

    const result = await processOutbox({
      apiBaseUrl: `http://127.0.0.1:${mockPort}`,
      botToken: fakeBotToken,
      chatId: fakeChatId,
    });

    expect(result.sent).toBeGreaterThanOrEqual(1);

    const [updated] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(updated.status).toBe("SENT");
    expect(updated.sentAt).toBeInstanceOf(Date);
  });

  it("retries on failure with exponential backoff and fails when attempts exhausted", async () => {
    mockStatusCode = 500;
    mockResponseBody = { ok: false, description: "Internal Server Error" };

    const key = `test_retry_${Date.now()}`;
    const item = await enqueueOutboxItem("TELEGRAM_SHIFT_CLOSE", samplePayload, key, db);

    // Attempt 1 (maxAttempts = 2)
    const res1 = await processOutbox({
      apiBaseUrl: `http://127.0.0.1:${mockPort}`,
      botToken: fakeBotToken,
      chatId: fakeChatId,
      maxAttempts: 2,
      initialBackoffSeconds: 1,
    });
    expect(res1.failed).toBeGreaterThanOrEqual(1);

    const [after1] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(after1.status).toBe("PENDING");
    expect(after1.attempts).toBe(1);
    expect(after1.nextAttemptAt).toBeDefined();

    // Fast-forward nextAttemptAt to past
    await db
      .update(schema.outbox)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(schema.outbox.id, item!.id));

    // Attempt 2 (exhausts maxAttempts 2 -> FAILED)
    await processOutbox({
      apiBaseUrl: `http://127.0.0.1:${mockPort}`,
      botToken: fakeBotToken,
      chatId: fakeChatId,
      maxAttempts: 2,
      initialBackoffSeconds: 1,
    });

    const [after2] = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.id, item!.id));
    expect(after2.status).toBe("FAILED");
    expect(after2.attempts).toBe(2);
  });

  it("enforces idempotency key uniqueness", async () => {
    const key = `idempotent_${Date.now()}`;
    const first = await enqueueOutboxItem("TELEGRAM_SHIFT_CLOSE", samplePayload, key, db);
    const second = await enqueueOutboxItem("TELEGRAM_SHIFT_CLOSE", samplePayload, key, db);

    expect(first).not.toBeNull();
    expect(second).toBeNull(); // On conflict do nothing
  });
});
