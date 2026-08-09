import { z } from "zod";
import { inventory } from "@/domain/seed";
import { reserveInventory } from "@/domain/commerce";

const schema = z.object({ requestId: z.string().min(4), sku: z.string(), quantity: z.number().int().positive(), expectedVersion: z.number().int().optional(), replay: z.boolean().default(false) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid reservation", issues: parsed.error.issues }, { status: 400 });
  try {
    const result = reserveInventory(inventory, parsed.data, parsed.data.replay ? new Set([parsed.data.requestId]) : new Set());
    return Response.json(result, { status: result.status === "REJECTED" ? 409 : 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Reservation failed" }, { status: 404 });
  }
}
