import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

describe("Database Transaction Atomicity & Connection Binding", () => {
  const rand = () => Math.random().toString(36).slice(2, 8);
  let testUserId: number;

  beforeAll(async () => {
    const [user] = await db
      .insert(schema.users)
      .values({
        username: `tx_user_${rand()}`,
        passwordHash: "dummy",
        fullName: "Tx Test User",
        role: "QUAN_LY",
      })
      .returning({ id: schema.users.id });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    }
  });

  it("persists inserted data when transaction completes successfully", async () => {
    const code = `KV_${rand()}`;
    await db.transaction(async (tx) => {
      await tx.insert(schema.areas).values({
        code,
        name: "Committed Area",
        displayOrder: 99,
      });
    });

    const found = await db
      .select()
      .from(schema.areas)
      .where(eq(schema.areas.code, code))
      .limit(1);

    expect(found.length).toBe(1);
    expect(found[0].name).toBe("Committed Area");

    await db.delete(schema.areas).where(eq(schema.areas.code, code));
  });

  it("rolls back all prior statements when transaction throws halfway", async () => {
    const code = `KV_${rand()}`;
    let threw = false;

    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.areas).values({
          code,
          name: "Rollback Area",
          displayOrder: 99,
        });
        throw new Error("Simulated mid-transaction failure");
      });
    } catch (err: unknown) {
      threw = true;
      expect((err as Error).message).toContain("Simulated mid-transaction failure");
    }

    expect(threw).toBe(true);

    const found = await db
      .select()
      .from(schema.areas)
      .where(eq(schema.areas.code, code))
      .limit(1);

    expect(found.length).toBe(0);
  });

  it("binds all statements in the same transaction to the exact same backend PID across parallel runs", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }).map(async (_, idx) => {
        return db.transaction(async (tx) => {
          const res1 = await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() as pid`);
          await new Promise((r) => setTimeout(r, 15));
          const res2 = await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() as pid`);

          const pid1 = res1.rows?.[0]?.pid;
          const pid2 = res2.rows?.[0]?.pid;

          return { idx, pid1, pid2 };
        });
      }),
    );

    for (const r of results) {
      expect(r.pid1).toBeDefined();
      expect(r.pid2).toBeDefined();
      expect(r.pid1).toBe(r.pid2);
    }
  });
});
