import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, tables, users, shifts, payments } from "@/db/schema";
import type { TokenPayload } from "@/server/auth/jwt";

export interface InvoiceItem {
  id: number;
  orderCode: string;
  orderType: string;
  tableName: string | null;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: string | null;
  status: string;
  version: number;
  queueNumber: number | null;
  queueDate: string | null;
  paidAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  cashierName: string | null;
  shiftId: number;
  shiftCode: string | null;
}

export interface ListInvoicesParams {
  scope?: string;
  page?: number;
  limit?: number;
  user: TokenPayload;
}

export interface ListInvoicesResult {
  ok: boolean;
  data: InvoiceItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Lists invoices for the current shift or all open shifts (FR-11, FR-14).
 * THU_NGAN sees invoices of their own active shift.
 * QUAN_LY sees invoices across all active open shifts.
 */
export async function listInvoices(params: ListInvoicesParams): Promise<ListInvoicesResult> {
  const { page = 1, limit = 20, user } = params;
  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);

  // 1. Determine active shift IDs based on role
  let shiftConditions;
  if (user.role === "QUAN_LY") {
    const openShifts = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.status, "DANG_MO"));
    const shiftIds = openShifts.map((s) => s.id);
    if (shiftIds.length === 0) {
      return {
        ok: true,
        data: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      };
    }
    shiftConditions = inArray(orders.shiftId, shiftIds);
  } else {
    // THU_NGAN
    const [ownShift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.cashierId, user.userId), eq(shifts.status, "DANG_MO")))
      .limit(1);

    if (!ownShift) {
      return {
        ok: true,
        data: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      };
    }
    shiftConditions = eq(orders.shiftId, ownShift.id);
  }

  // 2. Query count
  const [countResult] = await db
    .select({ count: sql<string>`count(*)` })
    .from(orders)
    .where(
      and(
        shiftConditions,
        inArray(orders.status, ["DA_THANH_TOAN", "DA_HUY"]),
      ),
    );

  const total = Number(countResult?.count ?? 0);
  const totalPages = Math.ceil(total / limit);

  if (total === 0) {
    return {
      ok: true,
      data: [],
      pagination: { total: 0, page, limit, totalPages: 0 },
    };
  }

  // 3. Query items
  const rows = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      orderType: orders.orderType,
      tableName: tables.name,
      totalAmount: orders.totalAmount,
      discountAmount: orders.discountAmount,
      finalAmount: orders.finalAmount,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      version: orders.version,
      queueNumber: orders.queueNumber,
      queueDate: orders.queueDate,
      paidAt: orders.paidAt,
      voidedAt: orders.voidedAt,
      voidReason: orders.voidReason,
      createdAt: orders.createdAt,
      cashierName: users.fullName,
      shiftId: orders.shiftId,
      shiftCode: shifts.shiftCode,
    })
    .from(orders)
    .leftJoin(tables, eq(orders.tableId, tables.id))
    .leftJoin(users, eq(orders.createdById, users.id))
    .leftJoin(shifts, eq(orders.shiftId, shifts.id))
    .where(
      and(
        shiftConditions,
        inArray(orders.status, ["DA_THANH_TOAN", "DA_HUY"]),
      ),
    )
    .orderBy(desc(orders.id))
    .limit(limit)
    .offset(offset);

  return {
    ok: true,
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}
