export type Currency = "USD" | "EUR" | "CNY";
export type Incoterm = "EXW" | "FOB" | "CIF" | "DDP";
export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type LeadStage = "NEW" | "QUALIFIED" | "RESEARCHED" | "CONTACT_READY" | "CUSTOMER";
export type OrderStage =
  | "SIGNED"
  | "PROCUREMENT"
  | "PRODUCTION"
  | "QUALITY_CHECK"
  | "BOOKED"
  | "CUSTOMS"
  | "IN_TRANSIT"
  | "DELIVERED";

export interface Provenance {
  sourceId: string;
  label: string;
  kind: "trade-directory" | "exhibition" | "registry" | "company-site" | "synthetic-fixture";
  observedAt: string;
  url?: string;
  synthetic: true;
}

export interface Lead {
  id: string;
  tenantId: string;
  company: string;
  country: string;
  region: string;
  industry: string;
  employees: number;
  revenueBand: string;
  channels: string[];
  productsWanted: string[];
  certifications: string[];
  contact: { name: string; title: string; email: string };
  stage: LeadStage;
  score: number;
  scoreReasons: string[];
  provenance: Provenance[];
  lastSignalAt: string;
}

export interface EvidenceItem {
  id: string;
  label: string;
  result: string;
  confidence: number;
  observedAt: string;
  expiresInDays: number;
  provenance: Provenance;
}

export interface DueDiligence {
  leadId: string;
  legalName: string;
  registration: "ACTIVE" | "UNVERIFIED" | "DORMANT";
  sanctionsScreen: "CLEAR" | "POTENTIAL_MATCH" | "BLOCKED";
  adverseMedia: "NONE" | "REVIEW";
  domainAgeYears: number;
  paymentRisk: number;
  riskScore: number;
  tier: RiskTier;
  flags: string[];
  evidence: EvidenceItem[];
  reviewedAt: string;
  validUntil: string;
  humanReviewRequired: boolean;
}

export interface Customer {
  id: string;
  tenantId: string;
  leadId: string;
  company: string;
  country: string;
  industry: string;
  segment: "STRATEGIC" | "GROWTH" | "STANDARD";
  owner: string;
  preferredCurrency: Currency;
  preferredIncoterm: Incoterm;
  creditLimitUsd: number;
  paymentTerms: string;
  products: string[];
  tags: string[];
  nextAction: string;
  nextActionAt: string;
  lifetimeValueUsd: number;
}

export interface Product {
  sku: string;
  name: string;
  category: string;
  hsCode: string;
  unit: string;
  baseCostCny: number;
  listPriceUsd: number;
  weightKg: number;
  cartonQty: number;
  leadTimeDays: number;
}

export interface Supplier {
  id: string;
  name: string;
  region: string;
  categories: string[];
  qualityScore: number;
  deliveryScore: number;
  responseScore: number;
  sustainabilityScore: number;
  defectRate: number;
  onTimeRate: number;
  activePos: number;
  risk: RiskTier;
}

export interface InventoryItem {
  sku: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  inProduction: number;
  inbound: number;
  safetyStock: number;
  updatedAt: string;
  version: number;
}

export interface QuoteLine {
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCostCny: number;
  weightKg: number;
}

export interface QuoteInput {
  id: string;
  customerId: string;
  currency: Currency;
  incoterm: Incoterm;
  lines: QuoteLine[];
  exchangeRates: Record<Currency, number>;
  discountRate: number;
  freightUsd: number;
  insuranceRate: number;
  dutyRate: number;
  commissionRate: number;
  overheadUsd: number;
}

export interface QuoteResult {
  quoteId: string;
  currency: Currency;
  incoterm: Incoterm;
  goodsUsd: number;
  freightUsd: number;
  insuranceUsd: number;
  dutyUsd: number;
  commissionUsd: number;
  overheadUsd: number;
  revenueUsd: number;
  landedCostUsd: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  grossMargin: number;
  netMargin: number;
  customerTotal: number;
  guardrail: "PASS" | "REVIEW" | "BLOCK";
  warnings: string[];
}

export interface ShipmentMilestone {
  id: string;
  label: string;
  status: "DONE" | "CURRENT" | "UPCOMING" | "BLOCKED";
  plannedAt: string;
  actualAt?: string;
  owner: string;
  evidence: string;
  customerMessage: string;
}

export interface TradeOrder {
  id: string;
  tenantId: string;
  customerId: string;
  quoteId: string;
  poNumber: string;
  stage: OrderStage;
  currency: Currency;
  incoterm: Incoterm;
  amountUsd: number;
  destination: string;
  etd: string;
  eta: string;
  container: string;
  milestones: ShipmentMilestone[];
}

export interface CostLedger {
  orderId: string;
  revenueUsd: number;
  procurementUsd: number;
  freightUsd: number;
  insuranceUsd: number;
  dutyUsd: number;
  commissionUsd: number;
  bankFeesUsd: number;
  fxGainLossUsd: number;
  overheadUsd: number;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

export interface AutomationRun {
  id: string;
  name: string;
  status: "SUCCEEDED" | "RUNNING" | "HELD" | "FAILED";
  trigger: "SCHEDULE" | "EVENT" | "MANUAL";
  startedAt: string;
  finishedAt?: string;
  steps: { label: string; status: "DONE" | "RUNNING" | "SKIPPED" | "HELD"; detail: string }[];
  savedMinutes: number;
}

export type DocumentType =
  | "quotation"
  | "proforma-invoice"
  | "commercial-invoice"
  | "purchase-order"
  | "packing-list"
  | "customs-draft"
  | "origin-draft"
  | "shipping-update";

export interface WorkspaceState {
  schemaVersion: 3;
  tenantId: string;
  leads: Lead[];
  dueDiligence: DueDiligence[];
  customers: Customer[];
  products: Product[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  quotes: QuoteInput[];
  orders: TradeOrder[];
  ledgers: CostLedger[];
  events: AuditEvent[];
  automations: AutomationRun[];
  updatedAt: string;
}
