import { z } from "zod";
import { assessDueDiligence } from "@/domain/scoring";

const schema = z.object({
  leadId: z.string().min(3),
  registration: z.enum(["ACTIVE", "UNVERIFIED", "DORMANT"]),
  sanctionsScreen: z.enum(["CLEAR", "POTENTIAL_MATCH", "BLOCKED"]),
  adverseMedia: z.enum(["NONE", "REVIEW"]),
  paymentRisk: z.number().min(0).max(100),
  domainAgeYears: z.number().min(0).max(100),
  evidenceCount: z.number().int().min(0).max(20),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid research fixture", issues: parsed.error.issues }, { status: 400 });
  return Response.json({ ...assessDueDiligence(parsed.data), mode: "synthetic", legalDecision: false });
}
