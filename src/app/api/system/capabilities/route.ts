import { getCapabilitySnapshot } from "@/server/config";

export const runtime = "nodejs";

export async function GET() {
  const capabilities = getCapabilitySnapshot();
  return Response.json(capabilities, {
    status: capabilities.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
