import { generateTradeDocument, isDocumentType } from "@/domain/documents";

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isDocumentType(type)) return Response.json({ error: "Unknown document type" }, { status: 404 });
  const orderId = new URL(request.url).searchParams.get("order") ?? "SO-260731";
  const bytes = await generateTradeDocument(type, orderId);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${type}-${orderId}.pdf"`,
      "Cache-Control": "public, max-age=300",
      "X-Synthetic-Demo": "true",
    },
  });
}
