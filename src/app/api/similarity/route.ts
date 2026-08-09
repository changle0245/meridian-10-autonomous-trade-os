import { z } from "zod";
import { customers, leads } from "@/domain/seed";
import { findSimilarCustomers } from "@/domain/scoring";

const schema = z.object({ customerId: z.string() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid customer" }, { status: 400 });
  const customer = customers.find((item) => item.id === parsed.data.customerId);
  if (!customer) return Response.json({ error: "Customer not found" }, { status: 404 });
  return Response.json({ customerId: customer.id, algorithm: "weighted-jaccard-v1", results: findSimilarCustomers(customer, leads) });
}
