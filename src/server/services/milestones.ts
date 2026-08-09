import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { OrderStage } from "@/domain/types";
import type { RequestContext } from "@/server/auth/context";
import { AppError } from "@/server/errors";

export interface MilestoneAdvanceInput {
  requestId: string;
  orderId: string;
}

export interface MilestoneAdvanceResult {
  status: "ADVANCED" | "COMPLETED" | "IDEMPOTENT_REPLAY" | "IDEMPOTENCY_CONFLICT" | "NOT_FOUND" | "NO_CURRENT";
  requestId: string;
  orderId: string | null;
  completedMilestoneId: string | null;
  nextMilestoneId: string | null;
  orderStage: OrderStage | null;
  reason: string;
}

export type MilestoneSqlExecutor = (query: SQL) => Promise<unknown>;

const orderStageSchema = z.enum([
  "SIGNED",
  "PROCUREMENT",
  "PRODUCTION",
  "QUALITY_CHECK",
  "BOOKED",
  "CUSTOMS",
  "IN_TRANSIT",
  "DELIVERED",
]);

const rowSchema = z.object({
  status: z.enum(["ADVANCED", "COMPLETED", "IDEMPOTENT_REPLAY", "IDEMPOTENCY_CONFLICT", "NOT_FOUND", "NO_CURRENT"]),
  request_id: z.string(),
  order_id: z.string().nullable(),
  completed_milestone_id: z.string().nullable(),
  next_milestone_id: z.string().nullable(),
  order_stage: orderStageSchema.nullable(),
  reason: z.string(),
});

function rowsFromResult(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows;
  throw new AppError("INTERNAL_ERROR", "The database returned an unexpected milestone result");
}

export async function advanceMilestoneInDatabase(
  execute: MilestoneSqlExecutor,
  context: RequestContext,
  input: MilestoneAdvanceInput,
): Promise<MilestoneAdvanceResult> {
  const raw = await execute(sql`
    select * from meridian_advance_milestone(
      ${context.organizationId},
      ${context.userId},
      ${input.requestId},
      ${input.orderId}
    )
  `);
  const row = rowSchema.parse(rowsFromResult(raw)[0]);
  return {
    status: row.status,
    requestId: row.request_id,
    orderId: row.order_id,
    completedMilestoneId: row.completed_milestone_id,
    nextMilestoneId: row.next_milestone_id,
    orderStage: row.order_stage,
    reason: row.reason,
  };
}
