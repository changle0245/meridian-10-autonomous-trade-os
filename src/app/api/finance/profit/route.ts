import { z } from "zod";
import { calculateProfit, stressLedger } from "@/domain/commerce";
import { ledgers } from "@/domain/seed";

const schema = z.object({ orderId: z.string(), cnyWeakeningRate: z.number().min(-0.2).max(0.2).default(0), freightIncreaseRate: z.number().min(-0.5).max(2).default(0) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid scenario", issues: parsed.error.issues }, { status: 400 });
  const ledger = ledgers.find((item) => item.orderId === parsed.data.orderId);
  if (!ledger) return Response.json({ error: "Order ledger not found" }, { status: 404 });
  const stressed = stressLedger(ledger, parsed.data);
  return Response.json({ baseline: calculateProfit(ledger), scenario: calculateProfit(stressed), assumptions: parsed.data });
}
