import type { AppDatabase } from "./client";
import {
  companies,
  costEntries,
  customers as customerTable,
  dueDiligenceCases,
  inventoryBalances,
  leads as leadTable,
  memberships,
  organizations,
  portalGrants,
  products as productTable,
  quoteLines,
  quoteVersions,
  quotes as quoteTable,
  salesOrderLines,
  salesOrders,
  shipmentMilestones,
  shipments,
  suppliers as supplierTable,
  users,
} from "./schema";
import {
  customers,
  dueDiligence,
  inventory,
  leads,
  ledgers,
  orders,
  products,
  quotes,
  suppliers,
  TENANT_ID,
} from "@/domain/seed";
import { hashPortalToken } from "@/server/crypto";

export interface DemoSeedOptions {
  clerkOrganizationId?: string;
  clerkUserId?: string;
  portalToken?: string;
}

const productId = (sku: string) => `product-${sku.toLowerCase()}`;
const leadCompanyId = (leadId: string) => `company-${leadId.toLowerCase()}`;
const quoteVersionId = (quoteId: string) => `quote-version-${quoteId.toLowerCase()}-1`;
const jsonObject = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
const jsonRecords = (value: unknown[]) => JSON.parse(JSON.stringify(value)) as Array<Record<string, unknown>>;

export async function seedDemoDatabase(database: AppDatabase, options: DemoSeedOptions = {}) {
  await database.insert(organizations).values({
    id: TENANT_ID,
    externalIdentityId: options.clerkOrganizationId,
    slug: "meridian-demo",
    name: "Meridian Industrial Exports",
    defaultCurrency: "USD",
    operatingMode: "CONTROLLED",
    settings: { outbound: "draft", synthetic: true },
  }).onConflictDoNothing();

  await database.insert(users).values({
    id: "user-meridian-demo",
    externalIdentityId: options.clerkUserId,
    email: "operator@example.invalid",
    displayName: "Meridian Demo Operator",
  }).onConflictDoNothing();
  await database.insert(memberships).values({
    organizationId: TENANT_ID,
    userId: "user-meridian-demo",
    role: "OWNER",
  }).onConflictDoNothing();

  await database.insert(companies).values([
    ...leads.map((lead) => ({
      id: leadCompanyId(lead.id),
      organizationId: TENANT_ID,
      kind: (customers.some((customer) => customer.leadId === lead.id) ? "CUSTOMER" : "PROSPECT") as "CUSTOMER" | "PROSPECT",
      legalName: lead.company,
      countryCode: lead.country,
      region: lead.region,
      industry: lead.industry,
      attributes: { employees: lead.employees, revenueBand: lead.revenueBand, channels: lead.channels },
    })),
    ...suppliers.map((supplier) => ({
      id: `company-${supplier.id.toLowerCase()}`,
      organizationId: TENANT_ID,
      kind: "SUPPLIER" as const,
      legalName: supplier.name,
      countryCode: "CN",
      region: supplier.region,
      industry: supplier.categories.join(", "),
      attributes: { synthetic: true },
    })),
  ]).onConflictDoNothing();

  await database.insert(leadTable).values(leads.map((lead) => ({
    id: lead.id,
    organizationId: TENANT_ID,
    companyId: leadCompanyId(lead.id),
    sourceKey: lead.provenance[0]?.sourceId ?? lead.id,
    stage: lead.stage,
    score: lead.score,
    contact: lead.contact,
    productsWanted: lead.productsWanted,
    scoreReasons: lead.scoreReasons,
    provenance: jsonRecords(lead.provenance),
    lastSignalAt: lead.lastSignalAt,
  }))).onConflictDoNothing();

  await database.insert(dueDiligenceCases).values(dueDiligence.map((item) => ({
    id: `dd-${item.leadId.toLowerCase()}`,
    organizationId: TENANT_ID,
    leadId: item.leadId,
    companyId: leadCompanyId(item.leadId),
    status: item.humanReviewRequired ? "HELD" : "CLEARED",
    tier: item.tier,
    riskScore: item.riskScore,
    registration: item.registration,
    sanctionsScreen: item.sanctionsScreen,
    adverseMedia: item.adverseMedia,
    humanReviewRequired: item.humanReviewRequired,
    flags: item.flags,
    evidence: jsonRecords(item.evidence),
    reviewedAt: item.reviewedAt,
    validUntil: item.validUntil,
  }))).onConflictDoNothing();

  await database.insert(customerTable).values(customers.map((customer) => ({
    id: customer.id,
    organizationId: TENANT_ID,
    companyId: leadCompanyId(customer.leadId),
    leadId: customer.leadId,
    ownerUserId: "user-meridian-demo",
    segment: customer.segment,
    preferredCurrency: customer.preferredCurrency,
    preferredIncoterm: customer.preferredIncoterm,
    creditLimitUsd: customer.creditLimitUsd,
    paymentTerms: customer.paymentTerms,
    nextAction: customer.nextAction,
    nextActionAt: customer.nextActionAt,
    tags: customer.tags,
  }))).onConflictDoNothing();

  await database.insert(productTable).values(products.map((product) => ({
    id: productId(product.sku),
    organizationId: TENANT_ID,
    sku: product.sku,
    name: product.name,
    category: product.category,
    hsCode: product.hsCode,
    unit: product.unit,
    baseCostCny: product.baseCostCny,
    listPriceUsd: product.listPriceUsd,
    weightKg: product.weightKg,
    cartonQuantity: product.cartonQty,
    leadTimeDays: product.leadTimeDays,
  }))).onConflictDoNothing();

  await database.insert(supplierTable).values(suppliers.map((supplier) => ({
    id: supplier.id,
    organizationId: TENANT_ID,
    companyId: `company-${supplier.id.toLowerCase()}`,
    qualityScore: supplier.qualityScore,
    deliveryScore: supplier.deliveryScore,
    responseScore: supplier.responseScore,
    sustainabilityScore: supplier.sustainabilityScore,
    defectRate: supplier.defectRate,
    onTimeRate: supplier.onTimeRate,
    risk: supplier.risk,
  }))).onConflictDoNothing();

  await database.insert(inventoryBalances).values(inventory.map((item) => ({
    id: `inventory-${item.sku.toLowerCase()}`,
    organizationId: TENANT_ID,
    productId: productId(item.sku),
    warehouseCode: item.warehouse,
    onHand: item.onHand,
    reserved: item.reserved,
    inProduction: item.inProduction,
    inbound: item.inbound,
    safetyStock: item.safetyStock,
    version: item.version,
    updatedAt: item.updatedAt,
  }))).onConflictDoNothing();

  for (const quote of quotes) {
    await database.insert(quoteTable).values({
      id: quote.id,
      organizationId: TENANT_ID,
      quoteNumber: quote.id,
      customerId: quote.customerId,
      status: "APPROVED",
      currentVersion: 1,
    }).onConflictDoNothing();
    await database.insert(quoteVersions).values({
      id: quoteVersionId(quote.id),
      organizationId: TENANT_ID,
      quoteId: quote.id,
      version: 1,
      currency: quote.currency,
      incoterm: quote.incoterm,
      exchangeRates: quote.exchangeRates,
      pricingInput: jsonObject(quote),
      pricingResult: {},
      guardrail: "REVIEW",
      approvedByUserId: "user-meridian-demo",
    }).onConflictDoNothing();
    await database.insert(quoteLines).values(quote.lines.map((line, index) => ({
      id: `${quote.id}-line-${index + 1}`,
      organizationId: TENANT_ID,
      quoteVersionId: quoteVersionId(quote.id),
      productId: productId(line.sku),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unitCostCny: line.unitCostCny,
      weightKg: line.weightKg,
    }))).onConflictDoNothing();
  }

  for (const order of orders) {
    const sourceQuote = quotes.find((quote) => quote.id === order.quoteId && quote.customerId === order.customerId);
    await database.insert(salesOrders).values({
      id: order.id,
      organizationId: TENANT_ID,
      orderNumber: order.id,
      customerId: order.customerId,
      quoteVersionId: sourceQuote ? quoteVersionId(sourceQuote.id) : null,
      customerPoNumber: order.poNumber,
      stage: order.stage,
      currency: order.currency,
      incoterm: order.incoterm,
      amountUsd: order.amountUsd,
      destination: order.destination,
      estimatedDeparture: order.etd,
      estimatedArrival: order.eta,
      container: order.container,
    }).onConflictDoNothing();

    if (sourceQuote) {
      await database.insert(salesOrderLines).values(sourceQuote.lines.map((line, index) => ({
        id: `${order.id}-line-${index + 1}`,
        organizationId: TENANT_ID,
        orderId: order.id,
        productId: productId(line.sku),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      }))).onConflictDoNothing();
    }

    const shipmentId = `shipment-${order.id.toLowerCase()}`;
    await database.insert(shipments).values({
      id: shipmentId,
      organizationId: TENANT_ID,
      salesOrderId: order.id,
      reference: `SHIP-${order.id}`,
      status: order.stage,
      estimatedDeparture: `${order.etd}T00:00:00.000Z`,
      estimatedArrival: `${order.eta}T00:00:00.000Z`,
    }).onConflictDoNothing();
    await database.insert(shipmentMilestones).values(order.milestones.map((milestone, index) => ({
      id: milestone.id,
      organizationId: TENANT_ID,
      shipmentId,
      sequence: index + 1,
      kind: milestone.label.toUpperCase().replaceAll(" ", "_"),
      label: milestone.label,
      status: milestone.status,
      plannedAt: milestone.plannedAt.length === 10 ? `${milestone.plannedAt}T00:00:00.000Z` : milestone.plannedAt,
      actualAt: milestone.actualAt,
      owner: milestone.owner,
      evidence: { summary: milestone.evidence, synthetic: true },
      customerMessage: milestone.customerMessage,
    }))).onConflictDoNothing();
  }

  for (const ledger of ledgers) {
    const entries = [
      ["PROCUREMENT", ledger.procurementUsd], ["FREIGHT", ledger.freightUsd], ["INSURANCE", ledger.insuranceUsd],
      ["DUTY", ledger.dutyUsd], ["COMMISSION", ledger.commissionUsd], ["BANK_FEES", ledger.bankFeesUsd],
      ["FX_GAIN_LOSS", -ledger.fxGainLossUsd], ["OVERHEAD", ledger.overheadUsd],
    ] as const;
    await database.insert(costEntries).values(entries.map(([kind, amount], index) => ({
      id: `${ledger.orderId}-cost-${index + 1}`,
      organizationId: TENANT_ID,
      salesOrderId: ledger.orderId,
      kind,
      currency: "USD",
      amount,
      amountUsd: amount,
      source: "DETERMINISTIC_SEED",
      metadata: { synthetic: true, revenueUsd: ledger.revenueUsd },
    }))).onConflictDoNothing();
  }

  if (options.portalToken) {
    await database.insert(portalGrants).values({
      id: "portal-grant-nordwerk-demo",
      organizationId: TENANT_ID,
      customerId: "CUS-2401",
      salesOrderId: "SO-260731",
      tokenHash: hashPortalToken(options.portalToken),
      expiresAt: "2099-01-01T00:00:00.000Z",
    }).onConflictDoNothing();
  }

  return {
    organizationId: TENANT_ID,
    leads: leads.length,
    customers: customers.length,
    products: products.length,
    suppliers: suppliers.length,
    orders: orders.length,
    identityMapped: Boolean(options.clerkOrganizationId && options.clerkUserId),
    portalGrantCreated: Boolean(options.portalToken),
  };
}
