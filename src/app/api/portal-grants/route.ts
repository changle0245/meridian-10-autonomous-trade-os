import { z } from "zod";
import { getDatabase } from "@/db/client";
import { getRequestContext, requireAnyRole } from "@/server/auth/context";
import { getRuntimeConfig } from "@/server/config";
import { AppError, errorResponse } from "@/server/errors";
import { issuePortalGrantInDatabase } from "@/server/services/portal-grants";

const schema = z.object({
  requestId: z.string().min(8).max(160),
  orderId: z.string().min(3).max(100),
  expiresInHours: z.number().int().min(1).max(720).default(168),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid portal grant request", issues: parsed.error.issues } }, { status: 400 });
  }

  try {
    const config = getRuntimeConfig();
    if (config.dataMode !== "database") {
      throw new AppError("CONFLICT", "Secure portal grant issuance requires DATA_MODE=database");
    }
    if (!config.portalTokenSecret) {
      throw new AppError("CONFIGURATION_ERROR", "PORTAL_TOKEN_SECRET is required to issue customer portal links");
    }
    const context = await getRequestContext();
    requireAnyRole(context, ["OWNER", "ADMIN", "OPS", "SALES"]);
    const database = getDatabase();
    const result = await issuePortalGrantInDatabase(
      (query) => database.execute(query),
      context,
      parsed.data,
      config.portalTokenSecret,
    );
    const status = result.status === "CREATED" ? 201
      : result.status === "NOT_FOUND" ? 404
        : result.status === "IDEMPOTENCY_CONFLICT" || result.status === "INVALID_DURATION" ? 409
          : 200;
    const portalUrl = result.token ? new URL(`/portal/${encodeURIComponent(result.token)}`, request.url).toString() : null;
    return Response.json({ ...result, token: undefined, portalUrl, mode: "database" }, {
      status,
      headers: {
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
