import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { getTestDbUrl } from "../setup/test-config";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

const mockCookies = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = mockCookies.get(name);
      return val ? { name, value: val } : undefined;
    },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    (error as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
    throw error;
  }),
}));

import { requireOpenShiftPage } from "@/server/shifts/require-open-shift";

describe("requireOpenShiftPage redirect guard tests", () => {
  const testDbUrl = getTestDbUrl();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let cashierUser: schema.User;
  let cashierToken: string;

  const rand = () => Math.random().toString(36).slice(2, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool, { schema });

    const [cashier] = await db
      .insert(schema.users)
      .values({
        username: `csh_rd_${rand()}`,
        fullName: "Test Cashier Redirect",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();
    cashierUser = cashier;
    cashierToken = await signAuthToken({
      userId: cashier.id,
      username: cashier.username,
      fullName: cashier.fullName,
      role: "THU_NGAN",
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    mockCookies.clear();
  });

  it("redirects to /login when unauthenticated", async () => {
    await expect(requireOpenShiftPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /open-shift when user has no active shift", async () => {
    mockCookies.set(AUTH_COOKIE_NAME, cashierToken);
    await expect(requireOpenShiftPage()).rejects.toThrow("NEXT_REDIRECT:/open-shift");
  });

  it("redirects to /close-shift when shift is in CHO_DUYET state (preventing infinite loop)", async () => {
    mockCookies.set(AUTH_COOKIE_NAME, cashierToken);

    await db.insert(schema.shifts).values({
      shiftCode: `CA_CD_${rand()}`,
      cashierId: cashierUser.id,
      initialCash: 100_000,
      expectedCash: 100_000,
      actualCash: 100_000,
      difference: 0,
      status: "CHO_DUYET",
    });

    await expect(requireOpenShiftPage()).rejects.toThrow("NEXT_REDIRECT:/close-shift");
  });

  it("allows access and returns shift when status is DANG_MO", async () => {
    const [csh2] = await db
      .insert(schema.users)
      .values({
        username: `csh_dm_${rand()}`,
        fullName: "Open Cashier",
        role: "THU_NGAN",
        passwordHash: "dummy",
      })
      .returning();

    const token2 = await signAuthToken({
      userId: csh2.id,
      username: csh2.username,
      fullName: csh2.fullName,
      role: "THU_NGAN",
    });

    const [openShift] = await db
      .insert(schema.shifts)
      .values({
        shiftCode: `CA_DM_${rand()}`,
        cashierId: csh2.id,
        initialCash: 200_000,
        status: "DANG_MO",
      })
      .returning();

    mockCookies.set(AUTH_COOKIE_NAME, token2);
    const result = await requireOpenShiftPage();

    expect(result.user.userId).toBe(csh2.id);
    expect(result.shift.id).toBe(openShift.id);
    expect(result.shift.status).toBe("DANG_MO");
  });
});
