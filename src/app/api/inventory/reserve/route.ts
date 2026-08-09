import { z } from "zod";
import { inventory } from "@/domain/seed";
import { reserveInventory } from "@/domain/commerce";
import { getDatabase } from "@/db/client";
import { getRequestContext, requireAnyRole } from "@/server/auth/context";
import { getRuntimeConfig } from "@/server/config";
import { errorResponse } from "@/server/errors";
import { reserveInventoryInDatabase } from "@/server/services/inventory";

const schema = z.object({
  requestId: z.string().min(4).max(160),
  sku: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  expectedVersion: z.number().int().positive().optional(),
  orderId: z.string().min(1).max(100).optional(),
  warehouseCode: z.string().min(1).max(100).optional(),
  replay: z.boolean().default(false),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid reservation", issues: parsed.error.issues }, { status: 400 });
  let fixtureMode = false;
  try {
    const config = getRuntimeConfig();
    fixtureMode = config.dataMode === "fixture";
    if (config.dataMode === "database") {
      const context = await getRequestContext();
      requireAnyRole(context, ["OWNER", "ADMIN", "OPS", "SALES"]);
      const database = getDatabase();
      const result = await reserveInventoryInDatabase((query) => database.execute(query), context, parsed.data);
      const status = result.status === "NOT_FOUND" ? 404 : result.status === "REJECTED" || result.status === "IDEMPOTENCY_CONFLICT" ? 409 : 200;
      return Response.json({ ...result, mode: "database" }, { status });
    }

    const result = reserveInventory(inventory, parsed.data, parsed.data.replay ? new Set([parsed.data.requestId]) : new Set());
    return Response.json({ ...result, mode: "fixture" }, { status: result.status === "REJECTED" ? 409 : 200 });
  } catch (error) {
    if (fixtureMode && error instanceof Error && error.message.startsWith("Unknown SKU")) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return errorResponse(error);
  }
}
