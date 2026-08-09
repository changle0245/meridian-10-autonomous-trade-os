import { start } from "workflow/api";
import { z } from "zod";
import { orderFulfillmentWorkflow } from "@/workflows/order-fulfillment";

const schema = z.object({ orderId: z.string().regex(/^SO-/), tenantId: z.literal("tenant-meridian-demo"), customerId: z.string().regex(/^CUS-/), dryRun: z.literal(true) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid workflow request", issues: parsed.error.issues }, { status: 400 });
  const run = await start(orderFulfillmentWorkflow, [parsed.data]);
  return Response.json({ runId: run.runId, status: "QUEUED", durable: true, dryRun: true }, { status: 202 });
}
