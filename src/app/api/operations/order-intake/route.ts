import { calculateQuote } from "@/domain/commerce";
import { getDatabase } from "@/db/client";
import { getRequestContext, requireAnyRole } from "@/server/auth/context";
import { orderIntakeSchema } from "@/server/contracts/order-intake";
import { getRuntimeConfig } from "@/server/config";
import { AppError, errorResponse } from "@/server/errors";
import { createOrderIntakeInDatabase } from "@/server/services/order-intake";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = orderIntakeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid order intake", issues: parsed.error.issues } }, { status: 400 });
  }

  try {
    const config = getRuntimeConfig();
    if (config.dataMode !== "database") {
      throw new AppError("CONFLICT", "Shared order intake requires DATA_MODE=database");
    }
    const context = await getRequestContext();
    requireAnyRole(context, ["OWNER", "ADMIN", "OPS", "SALES"]);

    const pricingResult = calculateQuote({
      id: parsed.data.quote.quoteNumber,
      customerId: "pending-database-customer",
      ...parsed.data.quote,
    });
    if (pricingResult.guardrail === "BLOCK") {
      throw new AppError("CONFLICT", "Quote failed the commercial guardrail", { warnings: pricingResult.warnings });
    }

    const database = getDatabase();
    const result = await createOrderIntakeInDatabase(
      (query) => database.execute(query),
      context,
      { ...parsed.data, quote: { ...parsed.data.quote, pricingResult } },
    );
    const status = result.status === "CREATED" ? 201 : result.status === "HELD_FOR_REVIEW" ? 202 : result.status === "IDEMPOTENCY_CONFLICT" ? 409 : 200;
    return Response.json({ ...result, pricing: pricingResult, mode: "database" }, { status });
  } catch (error) {
    return errorResponse(error);
  }
}
