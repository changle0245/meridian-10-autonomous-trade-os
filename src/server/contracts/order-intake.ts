import { z } from "zod";

const jsonRecord = z.record(z.string(), z.unknown());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const orderIntakeSchema = z.object({
  requestId: z.string().min(8).max(160),
  company: z.object({
    legalName: z.string().min(2).max(240),
    tradingName: z.string().max(240).optional(),
    countryCode: z.string().min(2).max(3),
    region: z.string().max(120).optional(),
    industry: z.string().max(160).optional(),
    website: z.url().optional(),
    attributes: jsonRecord.default({}),
  }),
  lead: z.object({
    sourceKey: z.string().min(3).max(200),
    score: z.number().int().min(0).max(100),
    contact: jsonRecord.default({}),
    productsWanted: z.array(z.string().max(120)).max(50).default([]),
    scoreReasons: z.array(z.string().max(240)).max(50).default([]),
    provenance: z.array(jsonRecord).max(100).default([]),
  }),
  dueDiligence: z.object({
    tier: z.enum(["LOW", "MEDIUM", "HIGH", "BLOCKED"]),
    riskScore: z.number().int().min(0).max(100),
    registration: z.enum(["ACTIVE", "UNVERIFIED", "DORMANT"]),
    sanctionsScreen: z.enum(["CLEAR", "POTENTIAL_MATCH", "BLOCKED", "UNVERIFIED"]),
    adverseMedia: z.enum(["NONE", "REVIEW", "UNVERIFIED"]),
    humanReviewRequired: z.boolean(),
    flags: z.array(z.string().max(240)).max(100).default([]),
    evidence: z.array(jsonRecord).min(1).max(100),
  }),
  customer: z.object({
    segment: z.enum(["STRATEGIC", "GROWTH", "STANDARD"]).default("STANDARD"),
    creditLimitUsd: z.number().nonnegative().max(100_000_000).default(0),
    paymentTerms: z.string().min(2).max(240),
    tags: z.array(z.string().max(120)).max(50).default([]),
  }),
  quote: z.object({
    quoteNumber: z.string().min(3).max(100),
    validUntil: date.optional(),
    currency: z.enum(["USD", "EUR", "CNY"]),
    incoterm: z.enum(["EXW", "FOB", "CIF", "DDP"]),
    lines: z.array(z.object({
      sku: z.string().min(1).max(100),
      quantity: z.number().int().positive().max(10_000_000),
      unitPrice: z.number().positive(),
      unitCostCny: z.number().nonnegative(),
      weightKg: z.number().nonnegative(),
    })).min(1).max(100),
    exchangeRates: z.object({ USD: z.number().positive(), EUR: z.number().positive(), CNY: z.number().positive() }),
    discountRate: z.number().min(0).lt(0.5),
    freightUsd: z.number().nonnegative(),
    insuranceRate: z.number().min(0).max(0.2),
    dutyRate: z.number().min(0).max(1),
    commissionRate: z.number().min(0).max(0.5),
    overheadUsd: z.number().nonnegative(),
  }),
  order: z.object({
    orderNumber: z.string().min(3).max(100),
    customerPoNumber: z.string().max(100).optional(),
    destination: z.string().min(2).max(240),
    estimatedDeparture: date.optional(),
    estimatedArrival: date.optional(),
    container: z.string().max(100).optional(),
  }),
});

export type OrderIntakeRequest = z.infer<typeof orderIntakeSchema>;
