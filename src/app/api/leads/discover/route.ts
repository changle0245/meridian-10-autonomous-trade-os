import { z } from "zod";
import { leads } from "@/domain/seed";
import { runLeadDiscovery } from "@/domain/automation";

const schema = z.object({ mode: z.literal("synthetic").default("synthetic"), existingIds: z.array(z.string()).default([]) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const base = leads.filter((lead) => !parsed.data.existingIds.includes(lead.id));
  const result = runLeadDiscovery(base);
  return Response.json({ mode: "synthetic", realPeopleContacted: 0, ...result });
}
