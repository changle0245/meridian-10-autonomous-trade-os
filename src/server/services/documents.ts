import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { TradeDocumentSnapshot } from "@/domain/documents";
import type { Currency, Incoterm, OrderStage, ShipmentMilestone } from "@/domain/types";
import type { RequestContext } from "@/server/auth/context";

export type DocumentSqlExecutor = (query: SQL) => Promise<unknown>;

const orderRowSchema = z.object({
  internal_order_id: z.string(),
  order_number: z.string(),
  customer_id: z.string(),
  company: z.string(),
  country: z.string(),
  industry: z.string().nullable(),
  segment: z.string(),
  preferred_currency: z.string(),
  preferred_incoterm: z.string(),
  credit_limit_usd: z.coerce.number(),
  payment_terms: z.string(),
  quote_number: z.string(),
  quote_version_id: z.string(),
  currency: z.string(),
  incoterm: z.string(),
  amount_usd: z.coerce.number(),
  customer_po_number: z.string().nullable(),
  stage: z.string(),
  destination: z.string(),
  estimated_departure: z.string().nullable(),
  estimated_arrival: z.string().nullable(),
  container: z.string().nullable(),
  exchange_rates: z.record(z.string(), z.coerce.number()),
  pricing_input: z.record(z.string(), z.unknown()),
});

const lineRowSchema = z.object({
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  hs_code: z.string().nullable(),
  unit: z.string(),
  base_cost_cny: z.coerce.number(),
  list_price_usd: z.coerce.number(),
  product_weight_kg: z.coerce.number(),
  carton_quantity: z.coerce.number().int(),
  lead_time_days: z.coerce.number().int(),
  quantity: z.coerce.number().int(),
  unit_price: z.coerce.number(),
  unit_cost_cny: z.coerce.number(),
  line_weight_kg: z.coerce.number(),
});

const milestoneRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.string(),
  planned_at: z.string().nullable(),
  actual_at: z.string().nullable(),
  owner: z.string().nullable(),
  evidence: z.record(z.string(), z.unknown()),
  customer_message: z.string().nullable(),
});

function rows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows;
  return [];
}

const numberFrom = (record: Record<string, unknown>, key: string, fallback: number) => {
  const value = Number(record[key]);
  return Number.isFinite(value) ? value : fallback;
};

export async function getTradeDocumentSnapshot(
  execute: DocumentSqlExecutor,
  context: RequestContext,
  orderReference: string,
): Promise<TradeDocumentSnapshot | null> {
  const orderResult = await execute(sql`
    select
      sales_order.id as internal_order_id,
      sales_order.order_number,
      customer.id as customer_id,
      company.legal_name as company,
      company.country_code as country,
      company.industry,
      customer.segment,
      customer.preferred_currency,
      customer.preferred_incoterm,
      customer.credit_limit_usd,
      customer.payment_terms,
      quote.quote_number,
      quote_version.id as quote_version_id,
      sales_order.currency,
      sales_order.incoterm,
      sales_order.amount_usd,
      sales_order.customer_po_number,
      sales_order.stage::text as stage,
      sales_order.destination,
      sales_order.estimated_departure::text,
      sales_order.estimated_arrival::text,
      sales_order.container,
      quote_version.exchange_rates,
      quote_version.pricing_input
    from sales_orders as sales_order
    inner join customers as customer
      on customer.id = sales_order.customer_id and customer.organization_id = sales_order.organization_id
    inner join companies as company
      on company.id = customer.company_id and company.organization_id = sales_order.organization_id
    inner join quote_versions as quote_version
      on quote_version.id = sales_order.quote_version_id and quote_version.organization_id = sales_order.organization_id
    inner join quotes as quote
      on quote.id = quote_version.quote_id and quote.organization_id = sales_order.organization_id
    where sales_order.organization_id = ${context.organizationId}
      and (sales_order.id = ${orderReference} or sales_order.order_number = ${orderReference})
    limit 1
  `);
  const rawOrder = rows(orderResult)[0];
  if (!rawOrder) return null;
  const record = orderRowSchema.parse(rawOrder);
  if (record.stage === "CANCELLED") return null;

  const lineResult = await execute(sql`
    select
      product.sku,
      product.name,
      product.category,
      product.hs_code,
      product.unit,
      product.base_cost_cny,
      product.list_price_usd,
      product.weight_kg as product_weight_kg,
      product.carton_quantity,
      product.lead_time_days,
      line.quantity,
      line.unit_price,
      line.unit_cost_cny,
      line.weight_kg as line_weight_kg
    from quote_lines as line
    inner join products as product
      on product.id = line.product_id and product.organization_id = line.organization_id
    where line.organization_id = ${context.organizationId}
      and line.quote_version_id = ${record.quote_version_id}
    order by line.id
  `);
  const lines = z.array(lineRowSchema).parse(rows(lineResult));
  if (lines.length === 0) return null;

  const milestoneResult = await execute(sql`
    select
      milestone.id,
      milestone.label,
      milestone.status,
      milestone.planned_at::text,
      milestone.actual_at::text,
      milestone.owner,
      milestone.evidence,
      milestone.customer_message
    from shipments as shipment
    inner join shipment_milestones as milestone
      on milestone.shipment_id = shipment.id and milestone.organization_id = shipment.organization_id
    where shipment.organization_id = ${context.organizationId}
      and shipment.sales_order_id = ${record.internal_order_id}
    order by milestone.sequence
  `);
  const milestones = z.array(milestoneRowSchema).parse(rows(milestoneResult)).map((milestone): ShipmentMilestone => ({
    id: milestone.id,
    label: milestone.label,
    status: ["DONE", "CURRENT", "UPCOMING", "BLOCKED"].includes(milestone.status)
      ? milestone.status as ShipmentMilestone["status"]
      : "UPCOMING",
    plannedAt: milestone.planned_at ?? "Pending",
    actualAt: milestone.actual_at ?? undefined,
    owner: milestone.owner ?? "Trade operations",
    evidence: typeof milestone.evidence.summary === "string" ? milestone.evidence.summary : "Evidence pending",
    customerMessage: milestone.customer_message ?? `${milestone.label} remains on plan.`,
  }));

  const exchangeRates = {
    USD: record.exchange_rates.USD ?? 1,
    EUR: record.exchange_rates.EUR ?? 1,
    CNY: record.exchange_rates.CNY ?? 1,
  };
  return {
    synthetic: false,
    customer: {
      id: record.customer_id,
      tenantId: context.organizationId,
      leadId: "database",
      company: record.company,
      country: record.country,
      industry: record.industry ?? "Unspecified",
      segment: (["STRATEGIC", "GROWTH", "STANDARD"].includes(record.segment) ? record.segment : "STANDARD") as "STRATEGIC" | "GROWTH" | "STANDARD",
      owner: "MERIDIAN Team",
      preferredCurrency: record.preferred_currency as Currency,
      preferredIncoterm: record.preferred_incoterm as Incoterm,
      creditLimitUsd: record.credit_limit_usd,
      paymentTerms: record.payment_terms,
      products: [],
      tags: [],
      nextAction: "Review document draft",
      nextActionAt: new Date().toISOString(),
      lifetimeValueUsd: 0,
    },
    quote: {
      id: record.quote_number,
      customerId: record.customer_id,
      currency: record.currency as Currency,
      incoterm: record.incoterm as Incoterm,
      lines: lines.map((line) => ({
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        unitCostCny: line.unit_cost_cny,
        weightKg: line.line_weight_kg,
      })),
      exchangeRates,
      discountRate: numberFrom(record.pricing_input, "discountRate", 0),
      freightUsd: numberFrom(record.pricing_input, "freightUsd", 0),
      insuranceRate: numberFrom(record.pricing_input, "insuranceRate", 0),
      dutyRate: numberFrom(record.pricing_input, "dutyRate", 0),
      commissionRate: numberFrom(record.pricing_input, "commissionRate", 0),
      overheadUsd: numberFrom(record.pricing_input, "overheadUsd", 0),
    },
    order: {
      id: record.order_number,
      tenantId: context.organizationId,
      customerId: record.customer_id,
      quoteId: record.quote_number,
      poNumber: record.customer_po_number ?? "PENDING",
      stage: record.stage as OrderStage,
      currency: record.currency as Currency,
      incoterm: record.incoterm as Incoterm,
      amountUsd: record.amount_usd,
      destination: record.destination,
      etd: record.estimated_departure ?? "Pending",
      eta: record.estimated_arrival ?? "Pending",
      container: record.container ?? "Pending",
      milestones,
    },
    products: lines.map((line) => ({
      sku: line.sku,
      name: line.name,
      category: line.category,
      hsCode: line.hs_code ?? "REVIEW",
      unit: line.unit,
      baseCostCny: line.base_cost_cny,
      listPriceUsd: line.list_price_usd,
      weightKg: line.product_weight_kg,
      cartonQty: line.carton_quantity,
      leadTimeDays: line.lead_time_days,
    })),
  };
}
