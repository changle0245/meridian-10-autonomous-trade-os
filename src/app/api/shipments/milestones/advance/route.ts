import { z } from "zod";
import { getDatabase } from "@/db/client";
import { getRequestContext, requireAnyRole } from "@/server/auth/context";
import { getRuntimeConfig } from "@/server/config";
import { AppError, errorResponse } from "@/server/errors";
import { advanceMilestoneInDatabase } from "@/server/services/milestones";

const schema = z.object({
  requestId: z.string().min(8).max(160),
  orderId: z.string().min(3).max(100),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid milestone request", issues: parsed.error.issues } }, { status: 400 });
  }

  try {
    if (getRuntimeConfig().dataMode !== "database") {
      throw new AppError("CONFLICT", "Shared milestone advancement requires DATA_MODE=database");
    }
    const context = await getRequestContext();
    requireAnyRole(context, ["OWNER", "ADMIN", "OPS"]);
    const database = getDatabase();
    const result = await advanceMilestoneInDatabase((query) => database.execute(query), context, parsed.data);
    const status = result.status === "NOT_FOUND" ? 404
      : result.status === "IDEMPOTENCY_CONFLICT" || result.status === "NO_CURRENT" ? 409
        : 200;
    return Response.json({ ...result, mode: "database", outbound: "held-draft" }, { status });
  } catch (error) {
    return errorResponse(error);
  }
}
