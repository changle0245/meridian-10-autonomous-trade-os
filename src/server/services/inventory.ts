import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { RequestContext } from "@/server/auth/context";
import { AppError } from "@/server/errors";

export interface InventoryReservationInput {
  requestId: string;
  sku: string;
  quantity: number;
  expectedVersion?: number;
  orderId?: string;
  warehouseCode?: string;
}

export interface DatabaseReservationResult {
  reservationId: string | null;
  status: "RESERVED" | "IDEMPOTENT_REPLAY" | "IDEMPOTENCY_CONFLICT" | "REJECTED" | "NOT_FOUND";
  requestId: string;
  availableBefore: number | null;
  availableAfter: number | null;
  balanceVersion: number | null;
  reason: string;
}

export type SqlExecutor = (query: SQL) => Promise<unknown>;

const databaseRowSchema = z.object({
  reservation_id: z.string().nullable(),
  status: z.enum(["RESERVED", "IDEMPOTENT_REPLAY", "IDEMPOTENCY_CONFLICT", "REJECTED", "NOT_FOUND"]),
  request_id: z.string(),
  available_before: z.coerce.number().int().nullable(),
  available_after: z.coerce.number().int().nullable(),
  balance_version: z.coerce.number().int().nullable(),
  reason: z.string(),
});

function rowsFromResult(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows;
  throw new AppError("INTERNAL_ERROR", "The database returned an unexpected reservation result");
}

export async function reserveInventoryInDatabase(
  execute: SqlExecutor,
  context: RequestContext,
  input: InventoryReservationInput,
): Promise<DatabaseReservationResult> {
  const raw = await execute(sql`
    select * from meridian_reserve_inventory(
      ${context.organizationId},
      ${context.userId},
      ${input.requestId},
      ${input.sku},
      ${input.quantity},
      ${input.expectedVersion ?? null},
      ${input.orderId ?? null},
      ${input.warehouseCode ?? null}
    )
  `);
  const row = databaseRowSchema.parse(rowsFromResult(raw)[0]);
  return {
    reservationId: row.reservation_id,
    status: row.status,
    requestId: row.request_id,
    availableBefore: row.available_before,
    availableAfter: row.available_after,
    balanceVersion: row.balance_version,
    reason: row.reason,
  };
}
