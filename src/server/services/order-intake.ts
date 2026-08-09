import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { RequestContext } from "@/server/auth/context";
import type { OrderIntakeRequest } from "@/server/contracts/order-intake";
import { AppError } from "@/server/errors";
import type { QuoteResult } from "@/domain/types";

export interface OrderIntakePayload extends OrderIntakeRequest {
  quote: OrderIntakeRequest["quote"] & { pricingResult: QuoteResult };
}

export interface OrderIntakeResult {
  status: "CREATED" | "IDEMPOTENT_REPLAY" | "IDEMPOTENCY_CONFLICT" | "HELD_FOR_REVIEW";
  requestId: string;
  leadId: string | null;
  customerId: string | null;
  quoteId: string | null;
  orderId: string | null;
  reason: string;
}

export type OrderIntakeSqlExecutor = (query: SQL) => Promise<unknown>;

const rowSchema = z.object({
  status: z.enum(["CREATED", "IDEMPOTENT_REPLAY", "IDEMPOTENCY_CONFLICT", "HELD_FOR_REVIEW"]),
  request_id: z.string(),
  lead_id: z.string().nullable(),
  customer_id: z.string().nullable(),
  quote_id: z.string().nullable(),
  order_id: z.string().nullable(),
  reason: z.string(),
});

function firstRow(result: unknown) {
  if (Array.isArray(result)) return result[0];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows[0];
  throw new AppError("INTERNAL_ERROR", "The database returned an unexpected order-intake result");
}

export async function createOrderIntakeInDatabase(
  execute: OrderIntakeSqlExecutor,
  context: RequestContext,
  payload: OrderIntakePayload,
): Promise<OrderIntakeResult> {
  const serialized = JSON.stringify(payload);
  const result = await execute(sql`
    select * from meridian_create_order_intake(
      ${context.organizationId},
      ${context.userId},
      ${payload.requestId},
      ${serialized}::jsonb
    )
  `);
  const row = rowSchema.parse(firstRow(result));
  return {
    status: row.status,
    requestId: row.request_id,
    leadId: row.lead_id,
    customerId: row.customer_id,
    quoteId: row.quote_id,
    orderId: row.order_id,
    reason: row.reason,
  };
}
