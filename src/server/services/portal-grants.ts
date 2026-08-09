import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { RequestContext } from "@/server/auth/context";
import { derivePortalToken, hashPortalToken } from "@/server/crypto";
import { AppError } from "@/server/errors";

export interface PortalGrantInput {
  requestId: string;
  orderId: string;
  expiresInHours: number;
}

export interface PortalGrantResult {
  status: "CREATED" | "IDEMPOTENT_REPLAY" | "IDEMPOTENCY_CONFLICT" | "NOT_FOUND" | "INVALID_DURATION";
  requestId: string;
  grantId: string | null;
  orderId: string | null;
  customerId: string | null;
  expiresAt: string | null;
  token: string | null;
  reason: string;
}

export type PortalGrantSqlExecutor = (query: SQL) => Promise<unknown>;

const rowSchema = z.object({
  status: z.enum(["CREATED", "IDEMPOTENT_REPLAY", "IDEMPOTENCY_CONFLICT", "NOT_FOUND", "INVALID_DURATION"]),
  request_id: z.string(),
  grant_id: z.string().nullable(),
  order_id: z.string().nullable(),
  customer_id: z.string().nullable(),
  grant_expires_at: z.string().nullable(),
  reason: z.string(),
});

function rowsFromResult(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows;
  throw new AppError("INTERNAL_ERROR", "The database returned an unexpected portal-grant result");
}

export async function issuePortalGrantInDatabase(
  execute: PortalGrantSqlExecutor,
  context: RequestContext,
  input: PortalGrantInput,
  tokenSecret: string,
): Promise<PortalGrantResult> {
  if (tokenSecret.length < 32) {
    throw new AppError("CONFIGURATION_ERROR", "PORTAL_TOKEN_SECRET must contain at least 32 characters");
  }
  const token = derivePortalToken(tokenSecret, context.organizationId, input.orderId, input.requestId);
  const raw = await execute(sql`
    select * from meridian_issue_portal_grant(
      ${context.organizationId},
      ${context.userId},
      ${input.requestId},
      ${input.orderId},
      ${hashPortalToken(token)},
      ${input.expiresInHours}
    )
  `);
  const row = rowSchema.parse(rowsFromResult(raw)[0]);
  return {
    status: row.status,
    requestId: row.request_id,
    grantId: row.grant_id,
    orderId: row.order_id,
    customerId: row.customer_id,
    expiresAt: row.grant_expires_at,
    token: row.status === "CREATED" || row.status === "IDEMPOTENT_REPLAY" ? token : null,
    reason: row.reason,
  };
}
