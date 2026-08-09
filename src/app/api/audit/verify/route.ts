import { z } from "zod";
import { verifyEventChain } from "@/domain/audit";

const eventSchema = z.object({ id: z.string(), tenantId: z.string(), at: z.string(), actor: z.string(), action: z.string(), entity: z.string(), entityId: z.string(), payload: z.record(z.string(), z.unknown()), previousHash: z.string(), hash: z.string() });

export async function POST(request: Request) {
  const parsed = z.object({ events: z.array(eventSchema).max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid audit chain", issues: parsed.error.issues }, { status: 400 });
  return Response.json(verifyEventChain(parsed.data.events));
}
