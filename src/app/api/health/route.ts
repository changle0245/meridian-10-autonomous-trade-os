import { documentLabels } from "@/domain/documents";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "MERIDIAN 10 Autonomous Trade OS",
    release: "level-10-synthetic-demo",
    dataMode: "deterministic-synthetic",
    documentTypes: Object.keys(documentLabels).length,
    workflow: "vercel-wdk",
    timestamp: "2026-08-09T09:30:00.000Z",
  });
}
