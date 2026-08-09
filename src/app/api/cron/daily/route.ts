import { createSeedState } from "@/domain/seed";
import { runDailyControlTower } from "@/domain/automation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized cron invocation", configured: Boolean(secret) }, { status: 401 });
  }
  return Response.json({ ok: true, ...runDailyControlTower(createSeedState()), executedAt: new Date().toISOString() });
}
