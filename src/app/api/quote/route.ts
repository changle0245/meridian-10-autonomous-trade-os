import { z } from "zod";
import { calculateQuote } from "@/domain/commerce";

const quoteSchema = z.object({
  id: z.string(), customerId: z.string(), currency: z.enum(["USD", "EUR", "CNY"]), incoterm: z.enum(["EXW", "FOB", "CIF", "DDP"]),
  lines: z.array(z.object({ sku: z.string(), quantity: z.number().int().positive(), unitPrice: z.number().positive(), unitCostCny: z.number().positive(), weightKg: z.number().positive() })).min(1),
  exchangeRates: z.object({ USD: z.number().positive(), EUR: z.number().positive(), CNY: z.number().positive() }),
  discountRate: z.number().min(0).max(0.49), freightUsd: z.number().min(0), insuranceRate: z.number().min(0).max(0.1), dutyRate: z.number().min(0).max(1), commissionRate: z.number().min(0).max(0.3), overheadUsd: z.number().min(0),
});

export async function POST(request: Request) {
  const parsed = quoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid quotation", issues: parsed.error.issues }, { status: 400 });
  try {
    return Response.json(calculateQuote(parsed.data));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Quote failed" }, { status: 422 });
  }
}
