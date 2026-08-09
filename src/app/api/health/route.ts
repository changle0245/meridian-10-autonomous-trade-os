import { documentLabels } from "@/domain/documents";
import { getCapabilitySnapshot } from "@/server/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const capabilities = getCapabilitySnapshot();
  return Response.json({
    ok: true,
    service: "MERIDIAN 10 Autonomous Trade OS",
    release: "integrated-core-v1",
    dataMode: capabilities.data === "fixture" ? "deterministic-synthetic" : "organization-database",
    capabilities,
    documentTypes: Object.keys(documentLabels).length,
    workflow: "vercel-wdk",
    timestamp: "2026-08-09T09:30:00.000Z",
  });
}
