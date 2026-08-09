import { and, asc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import {
  auditEvents,
  companies,
  costEntries,
  customers,
  dueDiligenceCases,
  inventoryBalances,
  leads,
  products,
  purchaseOrders,
  quoteLines,
  quoteVersions,
  quotes,
  salesOrders,
  shipmentMilestones,
  shipments,
  suppliers,
  users,
  workflowRuns,
} from "@/db/schema";
import type {
  AuditEvent,
  AutomationRun,
  CostLedger,
  Customer,
  DueDiligence,
  EvidenceItem,
  InventoryItem,
  Lead,
  LeadStage,
  OrderStage,
  Product,
  Provenance,
  QuoteInput,
  RiskTier,
  ShipmentMilestone,
  Supplier,
  TradeOrder,
  WorkspaceState,
} from "@/domain/types";
import type { RequestContext } from "@/server/auth/context";

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const objects = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(object) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const text = (value: unknown, fallback: string) => typeof value === "string" && value ? value : fallback;
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function provenance(value: unknown, fallbackId: string): Provenance[] {
  const allowed = new Set<Provenance["kind"]>(["trade-directory", "exhibition", "registry", "company-site", "synthetic-fixture"]);
  const rows = objects(value);
  if (rows.length === 0) {
    return [{ sourceId: fallbackId, label: "Database record", kind: "synthetic-fixture", observedAt: new Date().toISOString(), synthetic: true }];
  }
  return rows.map((item, index) => ({
    sourceId: text(item.sourceId ?? item.source, `${fallbackId}-${index + 1}`),
    label: text(item.label ?? item.source, "Database source"),
    kind: allowed.has(item.kind as Provenance["kind"]) ? item.kind as Provenance["kind"] : "synthetic-fixture",
    observedAt: text(item.observedAt, new Date().toISOString()),
    url: typeof item.url === "string" ? item.url : undefined,
    synthetic: true,
  }));
}

function evidence(value: unknown, fallbackId: string): EvidenceItem[] {
  const rows = objects(value);
  return rows.map((item, index) => ({
    id: text(item.id, `${fallbackId}-evidence-${index + 1}`),
    label: text(item.label ?? item.source, "Evidence"),
    result: text(item.result, "Recorded"),
    confidence: number(item.confidence, 0.8),
    observedAt: text(item.observedAt, new Date().toISOString()),
    expiresInDays: number(item.expiresInDays, 30),
    provenance: provenance(item.provenance ?? item, `${fallbackId}-source-${index + 1}`)[0],
  }));
}

export interface SharedWorkspaceProjection {
  state: WorkspaceState;
  auditLinked: boolean;
}

export async function getSharedWorkspaceProjection(database: AppDatabase, context: RequestContext): Promise<SharedWorkspaceProjection> {
  const organizationId = context.organizationId;
  const [
    leadRows,
    diligenceRows,
    customerRows,
    productRows,
    supplierRows,
    inventoryRows,
    quoteRows,
    quoteLineRows,
    orderRows,
    milestoneRows,
    costRows,
    purchaseOrderRows,
    auditRows,
    workflowRows,
  ] = await Promise.all([
    database.select({ lead: leads, company: companies }).from(leads)
      .innerJoin(companies, and(eq(companies.id, leads.companyId), eq(companies.organizationId, organizationId)))
      .where(eq(leads.organizationId, organizationId)),
    database.select().from(dueDiligenceCases).where(eq(dueDiligenceCases.organizationId, organizationId)),
    database.select({ customer: customers, company: companies, owner: users }).from(customers)
      .innerJoin(companies, and(eq(companies.id, customers.companyId), eq(companies.organizationId, organizationId)))
      .leftJoin(users, eq(users.id, customers.ownerUserId))
      .where(eq(customers.organizationId, organizationId)),
    database.select().from(products).where(eq(products.organizationId, organizationId)),
    database.select({ supplier: suppliers, company: companies }).from(suppliers)
      .innerJoin(companies, and(eq(companies.id, suppliers.companyId), eq(companies.organizationId, organizationId)))
      .where(eq(suppliers.organizationId, organizationId)),
    database.select({ balance: inventoryBalances, product: products }).from(inventoryBalances)
      .innerJoin(products, and(eq(products.id, inventoryBalances.productId), eq(products.organizationId, organizationId)))
      .where(eq(inventoryBalances.organizationId, organizationId)),
    database.select({ quote: quotes, version: quoteVersions }).from(quotes)
      .innerJoin(quoteVersions, and(
        eq(quoteVersions.quoteId, quotes.id),
        eq(quoteVersions.organizationId, organizationId),
        eq(quoteVersions.version, quotes.currentVersion),
      ))
      .where(eq(quotes.organizationId, organizationId)),
    database.select({ line: quoteLines, product: products }).from(quoteLines)
      .innerJoin(products, and(eq(products.id, quoteLines.productId), eq(products.organizationId, organizationId)))
      .where(eq(quoteLines.organizationId, organizationId)),
    database.select({ order: salesOrders, quoteVersion: quoteVersions, quote: quotes }).from(salesOrders)
      .leftJoin(quoteVersions, and(eq(quoteVersions.id, salesOrders.quoteVersionId), eq(quoteVersions.organizationId, organizationId)))
      .leftJoin(quotes, and(eq(quotes.id, quoteVersions.quoteId), eq(quotes.organizationId, organizationId)))
      .where(eq(salesOrders.organizationId, organizationId)),
    database.select({ milestone: shipmentMilestones, shipment: shipments }).from(shipmentMilestones)
      .innerJoin(shipments, and(eq(shipments.id, shipmentMilestones.shipmentId), eq(shipments.organizationId, organizationId)))
      .where(eq(shipmentMilestones.organizationId, organizationId))
      .orderBy(asc(shipmentMilestones.sequence)),
    database.select().from(costEntries).where(eq(costEntries.organizationId, organizationId)),
    database.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId)),
    database.select().from(auditEvents).where(eq(auditEvents.organizationId, organizationId)).orderBy(asc(auditEvents.sequence)),
    database.select().from(workflowRuns).where(eq(workflowRuns.organizationId, organizationId)).orderBy(asc(workflowRuns.createdAt)),
  ]);

  const leadItems: Lead[] = leadRows.map(({ lead, company }) => ({
    id: lead.id,
    tenantId: organizationId,
    company: company.legalName,
    country: company.countryCode,
    region: company.region ?? "Unspecified",
    industry: company.industry ?? "Unspecified",
    employees: number(object(company.attributes).employees),
    revenueBand: text(object(company.attributes).revenueBand, "Unspecified"),
    channels: strings(object(company.attributes).channels),
    productsWanted: lead.productsWanted,
    certifications: strings(object(company.attributes).certifications),
    contact: {
      name: text(object(lead.contact).name, "Unassigned"),
      title: text(object(lead.contact).title, "Contact"),
      email: text(object(lead.contact).email, "unknown@example.invalid"),
    },
    stage: (lead.stage === "DISQUALIFIED" ? "NEW" : lead.stage) as LeadStage,
    score: lead.score,
    scoreReasons: lead.scoreReasons,
    provenance: provenance(lead.provenance, lead.id),
    lastSignalAt: lead.lastSignalAt ?? lead.updatedAt,
  }));

  const diligenceItems: DueDiligence[] = diligenceRows.map((item) => ({
    leadId: item.leadId,
    legalName: leadItems.find((lead) => lead.id === item.leadId)?.company ?? item.companyId,
    registration: (["ACTIVE", "UNVERIFIED", "DORMANT"].includes(item.registration) ? item.registration : "UNVERIFIED") as DueDiligence["registration"],
    sanctionsScreen: (["CLEAR", "POTENTIAL_MATCH", "BLOCKED"].includes(item.sanctionsScreen) ? item.sanctionsScreen : "POTENTIAL_MATCH") as DueDiligence["sanctionsScreen"],
    adverseMedia: item.adverseMedia === "NONE" ? "NONE" : "REVIEW",
    domainAgeYears: 0,
    paymentRisk: item.riskScore,
    riskScore: item.riskScore,
    tier: item.tier as RiskTier,
    flags: item.flags,
    evidence: evidence(item.evidence, item.id),
    reviewedAt: item.reviewedAt ?? item.updatedAt,
    validUntil: item.validUntil ?? item.updatedAt,
    humanReviewRequired: item.humanReviewRequired,
  }));

  const amountByCustomer = new Map<string, number>();
  for (const { order } of orderRows) amountByCustomer.set(order.customerId, (amountByCustomer.get(order.customerId) ?? 0) + order.amountUsd);
  const customerItems: Customer[] = customerRows.map(({ customer, company, owner }) => ({
    id: customer.id,
    tenantId: organizationId,
    leadId: customer.leadId ?? "database",
    company: company.legalName,
    country: company.countryCode,
    industry: company.industry ?? "Unspecified",
    segment: (["STRATEGIC", "GROWTH", "STANDARD"].includes(customer.segment) ? customer.segment : "STANDARD") as Customer["segment"],
    owner: owner?.displayName ?? "Unassigned",
    preferredCurrency: customer.preferredCurrency as Customer["preferredCurrency"],
    preferredIncoterm: customer.preferredIncoterm as Customer["preferredIncoterm"],
    creditLimitUsd: customer.creditLimitUsd,
    paymentTerms: customer.paymentTerms,
    products: [],
    tags: customer.tags,
    nextAction: customer.nextAction ?? "Review customer record",
    nextActionAt: customer.nextActionAt ?? customer.updatedAt,
    lifetimeValueUsd: amountByCustomer.get(customer.id) ?? 0,
  }));

  const productItems: Product[] = productRows.map((item) => ({
    sku: item.sku,
    name: item.name,
    category: item.category,
    hsCode: item.hsCode ?? "REVIEW",
    unit: item.unit,
    baseCostCny: item.baseCostCny,
    listPriceUsd: item.listPriceUsd,
    weightKg: item.weightKg,
    cartonQty: item.cartonQuantity,
    leadTimeDays: item.leadTimeDays,
  }));

  const activePurchaseOrders = new Map<string, number>();
  for (const purchaseOrder of purchaseOrderRows) {
    if (!['CLOSED', 'CANCELLED'].includes(purchaseOrder.status)) {
      activePurchaseOrders.set(purchaseOrder.supplierId, (activePurchaseOrders.get(purchaseOrder.supplierId) ?? 0) + 1);
    }
  }
  const supplierItems: Supplier[] = supplierRows.map(({ supplier, company }) => ({
    id: supplier.id,
    name: company.legalName,
    region: company.region ?? "Unspecified",
    categories: (company.industry ?? "Unspecified").split(",").map((item) => item.trim()),
    qualityScore: supplier.qualityScore,
    deliveryScore: supplier.deliveryScore,
    responseScore: supplier.responseScore,
    sustainabilityScore: supplier.sustainabilityScore,
    defectRate: supplier.defectRate,
    onTimeRate: supplier.onTimeRate,
    activePos: activePurchaseOrders.get(supplier.id) ?? 0,
    risk: supplier.risk as RiskTier,
  }));

  const inventoryItems: InventoryItem[] = inventoryRows.map(({ balance, product }) => ({
    sku: product.sku,
    warehouse: balance.warehouseCode,
    onHand: balance.onHand,
    reserved: balance.reserved,
    inProduction: balance.inProduction,
    inbound: balance.inbound,
    safetyStock: balance.safetyStock,
    updatedAt: balance.updatedAt,
    version: balance.version,
  }));

  const quoteLinesByVersion = new Map<string, typeof quoteLineRows>();
  for (const row of quoteLineRows) quoteLinesByVersion.set(row.line.quoteVersionId, [...(quoteLinesByVersion.get(row.line.quoteVersionId) ?? []), row]);
  const quoteItems: QuoteInput[] = quoteRows.map(({ quote, version }) => {
    const input = object(version.pricingInput);
    const rates = object(version.exchangeRates);
    return {
      id: quote.quoteNumber,
      customerId: quote.customerId,
      currency: version.currency as QuoteInput["currency"],
      incoterm: version.incoterm as QuoteInput["incoterm"],
      lines: (quoteLinesByVersion.get(version.id) ?? []).map(({ line, product }) => ({
        sku: product.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCostCny: line.unitCostCny,
        weightKg: line.weightKg,
      })),
      exchangeRates: { USD: number(rates.USD, 1), EUR: number(rates.EUR, 1), CNY: number(rates.CNY, 1) },
      discountRate: number(input.discountRate),
      freightUsd: number(input.freightUsd),
      insuranceRate: number(input.insuranceRate),
      dutyRate: number(input.dutyRate),
      commissionRate: number(input.commissionRate),
      overheadUsd: number(input.overheadUsd),
    };
  });

  const milestonesByOrder = new Map<string, ShipmentMilestone[]>();
  for (const { milestone, shipment } of milestoneRows) {
    const mapped: ShipmentMilestone = {
      id: milestone.id,
      label: milestone.label,
      status: (["DONE", "CURRENT", "UPCOMING", "BLOCKED"].includes(milestone.status) ? milestone.status : "UPCOMING") as ShipmentMilestone["status"],
      plannedAt: milestone.plannedAt ?? "Pending",
      actualAt: milestone.actualAt ?? undefined,
      owner: milestone.owner ?? "Trade operations",
      evidence: text(object(milestone.evidence).summary, "Evidence pending"),
      customerMessage: milestone.customerMessage ?? `${milestone.label} remains on plan.`,
    };
    milestonesByOrder.set(shipment.salesOrderId, [...(milestonesByOrder.get(shipment.salesOrderId) ?? []), mapped]);
  }
  const orderItems: TradeOrder[] = orderRows
    .filter(({ order }) => order.stage !== "CANCELLED")
    .map(({ order, quote }) => ({
      id: order.orderNumber,
      tenantId: organizationId,
      customerId: order.customerId,
      quoteId: quote?.quoteNumber ?? "UNLINKED",
      poNumber: order.customerPoNumber ?? "PENDING",
      stage: order.stage as OrderStage,
      currency: order.currency as TradeOrder["currency"],
      incoterm: order.incoterm as TradeOrder["incoterm"],
      amountUsd: order.amountUsd,
      destination: order.destination,
      etd: order.estimatedDeparture ?? "Pending",
      eta: order.estimatedArrival ?? "Pending",
      container: order.container ?? "Pending",
      milestones: milestonesByOrder.get(order.id) ?? [],
    }));

  const orderByInternalId = new Map(orderRows.map(({ order }) => [order.id, order]));
  const ledgerMap = new Map<string, CostLedger>();
  for (const entry of costRows) {
    const order = orderByInternalId.get(entry.salesOrderId);
    if (!order) continue;
    const ledger = ledgerMap.get(entry.salesOrderId) ?? {
      orderId: order.orderNumber,
      revenueUsd: order.amountUsd,
      procurementUsd: 0,
      freightUsd: 0,
      insuranceUsd: 0,
      dutyUsd: 0,
      commissionUsd: 0,
      bankFeesUsd: 0,
      fxGainLossUsd: 0,
      overheadUsd: 0,
    };
    if (entry.kind === "PROCUREMENT") ledger.procurementUsd += entry.amountUsd;
    else if (entry.kind === "FREIGHT") ledger.freightUsd += entry.amountUsd;
    else if (entry.kind === "INSURANCE") ledger.insuranceUsd += entry.amountUsd;
    else if (entry.kind === "DUTY") ledger.dutyUsd += entry.amountUsd;
    else if (entry.kind === "COMMISSION") ledger.commissionUsd += entry.amountUsd;
    else if (entry.kind === "BANK_FEES") ledger.bankFeesUsd += entry.amountUsd;
    else if (entry.kind === "FX_GAIN_LOSS") ledger.fxGainLossUsd -= entry.amountUsd;
    else if (entry.kind === "OVERHEAD") ledger.overheadUsd += entry.amountUsd;
    ledgerMap.set(entry.salesOrderId, ledger);
  }

  const eventItems: AuditEvent[] = auditRows.map((event) => ({
    id: event.id,
    tenantId: organizationId,
    at: event.occurredAt,
    actor: event.actorId,
    action: event.action,
    entity: event.entityType,
    entityId: event.entityId,
    payload: event.payload,
    previousHash: event.previousHash,
    hash: event.hash,
  }));
  const auditLinked = auditRows.every((event, index) => index === 0 ? event.previousHash === "GENESIS" : event.previousHash === auditRows[index - 1].hash);

  const automationItems: AutomationRun[] = workflowRows.map((run) => ({
    id: run.externalRunId ?? run.id,
    name: run.workflowType,
    status: run.status === "SUCCEEDED" ? "SUCCEEDED" : run.status === "FAILED" ? "FAILED" : run.status === "WAITING" ? "HELD" : "RUNNING",
    trigger: "EVENT",
    startedAt: run.startedAt ?? run.createdAt,
    finishedAt: run.finishedAt ?? undefined,
    steps: [{ label: run.entityType, status: run.status === "SUCCEEDED" ? "DONE" : run.status === "FAILED" ? "HELD" : "RUNNING", detail: run.entityId }],
    savedMinutes: 0,
  }));

  return {
    auditLinked,
    state: {
      schemaVersion: 3,
      tenantId: organizationId,
      leads: leadItems,
      dueDiligence: diligenceItems,
      customers: customerItems,
      products: productItems,
      suppliers: supplierItems,
      inventory: inventoryItems,
      quotes: quoteItems,
      orders: orderItems,
      ledgers: [...ledgerMap.values()],
      events: eventItems,
      automations: automationItems,
      updatedAt: new Date().toISOString(),
    },
  };
}
