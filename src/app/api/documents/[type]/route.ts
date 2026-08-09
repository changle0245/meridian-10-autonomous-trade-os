import { getDatabase } from "@/db/client";
import { generateTradeDocument, generateTradeDocumentFromSnapshot, isDocumentType } from "@/domain/documents";
import { orders } from "@/domain/seed";
import { getRequestContext, requireAnyRole } from "@/server/auth/context";
import { getRuntimeConfig } from "@/server/config";
import { errorResponse } from "@/server/errors";
import { getTradeDocumentSnapshot } from "@/server/services/documents";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isDocumentType(type)) return Response.json({ error: "Unknown document type" }, { status: 404 });
  const orderId = new URL(request.url).searchParams.get("order") ?? "SO-260731";

  try {
    const config = getRuntimeConfig();
    let bytes: Uint8Array;
    let synthetic: boolean;
    if (config.dataMode === "fixture") {
      if (!orders.some((order) => order.id === orderId)) return Response.json({ error: "Unknown order" }, { status: 404 });
      bytes = await generateTradeDocument(type, orderId);
      synthetic = true;
    } else {
      const context = await getRequestContext();
      requireAnyRole(context, ["OWNER", "ADMIN", "OPS", "SALES", "FINANCE", "VIEWER"]);
      const database = getDatabase();
      const snapshot = await getTradeDocumentSnapshot((query) => database.execute(query), context, orderId);
      if (!snapshot) return Response.json({ error: "Unknown or incomplete order" }, { status: 404 });
      bytes = await generateTradeDocumentFromSnapshot(type, snapshot);
      synthetic = false;
    }

    const safeOrderId = orderId.replaceAll(/[^a-zA-Z0-9_-]/g, "-");
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${type}-${safeOrderId}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Document-Mode": synthetic ? "synthetic-demo" : "controlled-draft",
        ...(synthetic ? { "X-Synthetic-Demo": "true" } : {}),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
