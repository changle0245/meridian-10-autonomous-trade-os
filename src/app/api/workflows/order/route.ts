import { start } from "workflow/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { workflowRuns } from "@/db/schema";
import { getRequestContext, requireAnyRole } from "@/server/auth/context";
import { getRuntimeConfig } from "@/server/config";
import { sha256 } from "@/server/crypto";
import { errorResponse } from "@/server/errors";
import { orderFulfillmentWorkflow } from "@/workflows/order-fulfillment";

const schema = z.object({
  orderId: z.string().min(3).max(100),
  dryRun: z.boolean().default(true),
  tenantId: z.string().optional(),
  customerId: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid workflow request", issues: parsed.error.issues }, { status: 400 });

  try {
    const config = getRuntimeConfig();
    if (config.dataMode === "fixture") {
      const run = await start(orderFulfillmentWorkflow, [{
        orderId: parsed.data.orderId,
        tenantId: parsed.data.tenantId,
        customerId: parsed.data.customerId,
        mode: "fixture",
        dryRun: true,
      }]);
      return Response.json({ runId: run.runId, status: "QUEUED", durable: true, dryRun: true, mode: "fixture" }, { status: 202 });
    }

    const context = await getRequestContext();
    requireAnyRole(context, ["OWNER", "ADMIN", "OPS", "SALES"]);
    const database = getDatabase();
    const workflowRecordId = `workflow_${sha256(`${context.organizationId}:${crypto.randomUUID()}`).slice(0, 24)}`;
    await database.insert(workflowRuns).values({
      id: workflowRecordId,
      organizationId: context.organizationId,
      workflowType: "order-fulfillment",
      entityType: "sales_order",
      entityId: parsed.data.orderId,
      status: "QUEUED",
      input: { orderId: parsed.data.orderId },
    });

    const run = await start(orderFulfillmentWorkflow, [{
      orderId: parsed.data.orderId,
      organizationId: context.organizationId,
      actorId: context.userId,
      workflowRecordId,
      mode: "database",
      dryRun: false,
    }]);
    await database.update(workflowRuns).set({
      externalRunId: run.runId,
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(workflowRuns.id, workflowRecordId));
    return Response.json({ runId: run.runId, workflowRecordId, status: "QUEUED", durable: true, dryRun: false, mode: "database" }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
