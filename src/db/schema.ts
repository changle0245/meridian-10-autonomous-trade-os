import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const membershipRole = pgEnum("membership_role", ["OWNER", "ADMIN", "OPS", "SALES", "FINANCE", "VIEWER"]);
export const companyKind = pgEnum("company_kind", ["PROSPECT", "CUSTOMER", "SUPPLIER", "PARTNER"]);
export const leadStage = pgEnum("lead_stage", ["NEW", "QUALIFIED", "RESEARCHED", "CONTACT_READY", "CUSTOMER", "DISQUALIFIED"]);
export const riskTier = pgEnum("risk_tier", ["LOW", "MEDIUM", "HIGH", "BLOCKED"]);
export const quoteStatus = pgEnum("quote_status", ["DRAFT", "REVIEW", "APPROVED", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]);
export const orderStage = pgEnum("order_stage", ["SIGNED", "PROCUREMENT", "PRODUCTION", "QUALITY_CHECK", "BOOKED", "CUSTOMS", "IN_TRANSIT", "DELIVERED", "CANCELLED"]);
export const reservationStatus = pgEnum("reservation_status", ["RESERVED", "RELEASED", "CONSUMED"]);
export const workflowStatus = pgEnum("workflow_status", ["QUEUED", "RUNNING", "WAITING", "SUCCEEDED", "FAILED", "CANCELLED"]);
export const messageStatus = pgEnum("message_status", ["PENDING", "PROCESSING", "SENT", "FAILED", "HELD"]);
export const documentStatus = pgEnum("document_status", ["DRAFT", "REVIEW", "APPROVED", "ISSUED", "SUPERSEDED", "VOID"]);

const emptyObject = sql`'{}'::jsonb`;
const emptyArray = sql`'[]'::jsonb`;
const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: "number" });
const rate = (name: string) => numeric(name, { precision: 12, scale: 6, mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull();

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    externalIdentityId: text("external_identity_id"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    defaultCurrency: text("default_currency").default("USD").notNull(),
    operatingMode: text("operating_mode").default("CONTROLLED").notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("organizations_external_identity_unique").on(table.externalIdentityId),
    uniqueIndex("organizations_slug_unique").on(table.slug),
  ],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    externalIdentityId: text("external_identity_id"),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_external_identity_unique").on(table.externalIdentityId),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: membershipRole("role").default("VIEWER").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ name: "memberships_pk", columns: [table.organizationId, table.userId] }),
    index("memberships_user_idx").on(table.userId),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    kind: companyKind("kind").notNull(),
    legalName: text("legal_name").notNull(),
    tradingName: text("trading_name"),
    countryCode: text("country_code").notNull(),
    region: text("region"),
    industry: text("industry"),
    website: text("website"),
    registrationNumber: text("registration_number"),
    status: text("status").default("ACTIVE").notNull(),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("companies_org_kind_idx").on(table.organizationId, table.kind),
    uniqueIndex("companies_org_legal_country_unique").on(table.organizationId, table.legalName, table.countryCode),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
    sourceKey: text("source_key"),
    stage: leadStage("stage").default("NEW").notNull(),
    score: integer("score").default(0).notNull(),
    contact: jsonb("contact").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    productsWanted: jsonb("products_wanted").$type<string[]>().default(emptyArray).notNull(),
    scoreReasons: jsonb("score_reasons").$type<string[]>().default(emptyArray).notNull(),
    provenance: jsonb("provenance").$type<Array<Record<string, unknown>>>().default(emptyArray).notNull(),
    lastSignalAt: timestamp("last_signal_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("leads_org_stage_score_idx").on(table.organizationId, table.stage, table.score),
    uniqueIndex("leads_org_company_unique").on(table.organizationId, table.companyId),
    uniqueIndex("leads_org_source_unique").on(table.organizationId, table.sourceKey),
  ],
);

export const dueDiligenceCases = pgTable(
  "due_diligence_cases",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
    status: text("status").default("OPEN").notNull(),
    tier: riskTier("tier").default("MEDIUM").notNull(),
    riskScore: integer("risk_score").default(50).notNull(),
    registration: text("registration").default("UNVERIFIED").notNull(),
    sanctionsScreen: text("sanctions_screen").default("UNVERIFIED").notNull(),
    adverseMedia: text("adverse_media").default("UNVERIFIED").notNull(),
    humanReviewRequired: boolean("human_review_required").default(true).notNull(),
    flags: jsonb("flags").$type<string[]>().default(emptyArray).notNull(),
    evidence: jsonb("evidence").$type<Array<Record<string, unknown>>>().default(emptyArray).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("dd_org_tier_status_idx").on(table.organizationId, table.tier, table.status)],
);

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    segment: text("segment").default("STANDARD").notNull(),
    preferredCurrency: text("preferred_currency").default("USD").notNull(),
    preferredIncoterm: text("preferred_incoterm").default("FOB").notNull(),
    creditLimitUsd: money("credit_limit_usd").default(0).notNull(),
    paymentTerms: text("payment_terms").default("PREPAYMENT").notNull(),
    nextAction: text("next_action"),
    nextActionAt: timestamp("next_action_at", { withTimezone: true, mode: "string" }),
    tags: jsonb("tags").$type<string[]>().default(emptyArray).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("customers_org_company_unique").on(table.organizationId, table.companyId),
    index("customers_org_segment_idx").on(table.organizationId, table.segment),
  ],
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    hsCode: text("hs_code"),
    unit: text("unit").default("pc").notNull(),
    baseCostCny: money("base_cost_cny").default(0).notNull(),
    listPriceUsd: money("list_price_usd").default(0).notNull(),
    weightKg: numeric("weight_kg", { precision: 12, scale: 3, mode: "number" }).default(0).notNull(),
    cartonQuantity: integer("carton_quantity").default(1).notNull(),
    leadTimeDays: integer("lead_time_days").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("products_org_sku_unique").on(table.organizationId, table.sku)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
    qualityScore: integer("quality_score").default(0).notNull(),
    deliveryScore: integer("delivery_score").default(0).notNull(),
    responseScore: integer("response_score").default(0).notNull(),
    sustainabilityScore: integer("sustainability_score").default(0).notNull(),
    defectRate: rate("defect_rate").default(0).notNull(),
    onTimeRate: rate("on_time_rate").default(0).notNull(),
    risk: riskTier("risk").default("MEDIUM").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("suppliers_org_company_unique").on(table.organizationId, table.companyId)],
);

export const supplierProducts = pgTable(
  "supplier_products",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    supplierSku: text("supplier_sku"),
    currency: text("currency").default("CNY").notNull(),
    unitCost: money("unit_cost").notNull(),
    minimumOrderQuantity: integer("minimum_order_quantity").default(1).notNull(),
    leadTimeDays: integer("lead_time_days").default(0).notNull(),
    availableQuantity: integer("available_quantity").default(0).notNull(),
    sourceVersion: integer("source_version").default(1).notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("supplier_products_org_pair_unique").on(table.organizationId, table.supplierId, table.productId)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    quoteNumber: text("quote_number").notNull(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    status: quoteStatus("status").default("DRAFT").notNull(),
    currentVersion: integer("current_version").default(1).notNull(),
    validUntil: date("valid_until", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("quotes_org_number_unique").on(table.organizationId, table.quoteNumber)],
);

export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    currency: text("currency").notNull(),
    incoterm: text("incoterm").notNull(),
    exchangeRates: jsonb("exchange_rates").$type<Record<string, number>>().default(emptyObject).notNull(),
    pricingInput: jsonb("pricing_input").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    pricingResult: jsonb("pricing_result").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    guardrail: text("guardrail").default("REVIEW").notNull(),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("quote_versions_org_quote_version_unique").on(table.organizationId, table.quoteId, table.version)],
);

export const quoteLines = pgTable(
  "quote_lines",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    quoteVersionId: text("quote_version_id").notNull().references(() => quoteVersions.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: money("unit_price").notNull(),
    unitCostCny: money("unit_cost_cny").notNull(),
    weightKg: numeric("weight_kg", { precision: 12, scale: 3, mode: "number" }).default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("quote_lines_quote_idx").on(table.organizationId, table.quoteVersionId)],
);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    quoteVersionId: text("quote_version_id").references(() => quoteVersions.id, { onDelete: "set null" }),
    customerPoNumber: text("customer_po_number"),
    stage: orderStage("stage").default("SIGNED").notNull(),
    currency: text("currency").notNull(),
    incoterm: text("incoterm").notNull(),
    amountUsd: money("amount_usd").notNull(),
    destination: text("destination").notNull(),
    estimatedDeparture: date("estimated_departure", { mode: "string" }),
    estimatedArrival: date("estimated_arrival", { mode: "string" }),
    container: text("container"),
    version: integer("version").default(1).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sales_orders_org_number_unique").on(table.organizationId, table.orderNumber),
    index("sales_orders_org_stage_idx").on(table.organizationId, table.stage),
  ],
);

export const salesOrderLines = pgTable(
  "sales_order_lines",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: money("unit_price").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("sales_order_lines_order_idx").on(table.organizationId, table.orderId)],
);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    warehouseCode: text("warehouse_code").notNull(),
    onHand: integer("on_hand").default(0).notNull(),
    reserved: integer("reserved").default(0).notNull(),
    inProduction: integer("in_production").default(0).notNull(),
    inbound: integer("inbound").default(0).notNull(),
    safetyStock: integer("safety_stock").default(0).notNull(),
    version: integer("version").default(1).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("inventory_org_product_warehouse_unique").on(table.organizationId, table.productId, table.warehouseCode)],
);

export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    requestKey: text("request_key").notNull(),
    inventoryBalanceId: text("inventory_balance_id").notNull().references(() => inventoryBalances.id, { onDelete: "restrict" }),
    orderId: text("order_id").references(() => salesOrders.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull(),
    status: reservationStatus("status").default("RESERVED").notNull(),
    availableBefore: integer("available_before").notNull(),
    availableAfter: integer("available_after").notNull(),
    balanceVersion: integer("balance_version").notNull(),
    response: jsonb("response").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("stock_reservations_org_request_unique").on(table.organizationId, table.requestKey)],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    inventoryBalanceId: text("inventory_balance_id").notNull().references(() => inventoryBalances.id, { onDelete: "restrict" }),
    reservationId: text("reservation_id").references(() => stockReservations.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    balanceVersion: integer("balance_version").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default(emptyObject).notNull(),
  },
  (table) => [index("stock_movements_org_inventory_idx").on(table.organizationId, table.inventoryBalanceId, table.occurredAt)],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    purchaseOrderNumber: text("purchase_order_number").notNull(),
    supplierId: text("supplier_id").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
    salesOrderId: text("sales_order_id").references(() => salesOrders.id, { onDelete: "set null" }),
    status: text("status").default("DRAFT").notNull(),
    currency: text("currency").default("CNY").notNull(),
    amount: money("amount").default(0).notNull(),
    expectedAt: date("expected_at", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("purchase_orders_org_number_unique").on(table.organizationId, table.purchaseOrderNumber)],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitCost: money("unit_cost").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("purchase_order_lines_po_idx").on(table.organizationId, table.purchaseOrderId)],
);

export const shipments = pgTable(
  "shipments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    salesOrderId: text("sales_order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    status: text("status").default("PLANNED").notNull(),
    carrier: text("carrier"),
    bookingNumber: text("booking_number"),
    containerNumber: text("container_number"),
    estimatedDeparture: timestamp("estimated_departure", { withTimezone: true, mode: "string" }),
    estimatedArrival: timestamp("estimated_arrival", { withTimezone: true, mode: "string" }),
    actualDeparture: timestamp("actual_departure", { withTimezone: true, mode: "string" }),
    actualArrival: timestamp("actual_arrival", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("shipments_org_reference_unique").on(table.organizationId, table.reference)],
);

export const shipmentMilestones = pgTable(
  "shipment_milestones",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    shipmentId: text("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    status: text("status").default("UPCOMING").notNull(),
    plannedAt: timestamp("planned_at", { withTimezone: true, mode: "string" }),
    actualAt: timestamp("actual_at", { withTimezone: true, mode: "string" }),
    owner: text("owner"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    customerMessage: text("customer_message"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("shipment_milestones_org_sequence_unique").on(table.organizationId, table.shipmentId, table.sequence)],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    salesOrderId: text("sales_order_id").references(() => salesOrders.id, { onDelete: "set null" }),
    documentType: text("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    version: integer("version").default(1).notNull(),
    status: documentStatus("status").default("DRAFT").notNull(),
    contentHash: text("content_hash").notNull(),
    blobUrl: text("blob_url"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "string" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("document_versions_org_number_version_unique").on(table.organizationId, table.documentNumber, table.version)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    salesOrderId: text("sales_order_id").notNull().references(() => salesOrders.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    status: text("status").default("DRAFT").notNull(),
    currency: text("currency").notNull(),
    amount: money("amount").notNull(),
    dueAt: date("due_at", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("invoices_org_number_unique").on(table.organizationId, table.invoiceNumber)],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
    providerReference: text("provider_reference"),
    status: text("status").default("PENDING").notNull(),
    currency: text("currency").notNull(),
    amount: money("amount").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("payments_org_provider_reference_unique").on(table.organizationId, table.providerReference)],
);

export const costEntries = pgTable(
  "cost_entries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    salesOrderId: text("sales_order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    currency: text("currency").notNull(),
    amount: money("amount").notNull(),
    amountUsd: money("amount_usd").notNull(),
    exchangeRate: rate("exchange_rate").default(1).notNull(),
    source: text("source").notNull(),
    incurredAt: timestamp("incurred_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default(emptyObject).notNull(),
  },
  (table) => [index("cost_entries_org_order_idx").on(table.organizationId, table.salesOrderId)],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    externalRunId: text("external_run_id"),
    workflowType: text("workflow_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    status: workflowStatus("status").default("QUEUED").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    output: jsonb("output").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    error: jsonb("error").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("workflow_runs_external_unique").on(table.externalRunId),
    index("workflow_runs_org_entity_idx").on(table.organizationId, table.entityType, table.entityId),
  ],
);

export const inboxEvents = pgTable(
  "inbox_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    status: text("status").default("RECEIVED").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
    error: jsonb("error").$type<Record<string, unknown>>(),
  },
  (table) => [uniqueIndex("inbox_events_provider_external_unique").on(table.provider, table.externalEventId)],
);

export const outboxMessages = pgTable(
  "outbox_messages",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    deduplicationKey: text("deduplication_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    status: messageStatus("status").default("PENDING").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("outbox_messages_org_dedupe_unique").on(table.organizationId, table.deduplicationKey),
    index("outbox_messages_status_available_idx").on(table.status, table.availableAt),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    statusCode: integer("status_code").notNull(),
    response: jsonb("response").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("idempotency_records_org_scope_key_unique").on(table.organizationId, table.scope, table.idempotencyKey)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    sequence: bigint("sequence", { mode: "number" }).generatedAlwaysAsIdentity(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default(emptyObject).notNull(),
    previousHash: text("previous_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (table) => [
    uniqueIndex("audit_events_org_sequence_unique").on(table.organizationId, table.sequence),
    index("audit_events_org_entity_idx").on(table.organizationId, table.entityType, table.entityId),
  ],
);

export const portalGrants = pgTable(
  "portal_grants",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    salesOrderId: text("sales_order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true, mode: "string" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("portal_grants_token_hash_unique").on(table.tokenHash),
    index("portal_grants_org_order_idx").on(table.organizationId, table.salesOrderId),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type InventoryBalance = typeof inventoryBalances.$inferSelect;
export type StockReservation = typeof stockReservations.$inferSelect;
export type PortalGrant = typeof portalGrants.$inferSelect;
