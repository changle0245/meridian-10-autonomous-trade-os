import { PGlite } from "@electric-sql/pglite";
import { asc, count, eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { RequestContext } from "@/server/auth/context";
import { reserveInventoryInDatabase } from "@/server/services/inventory";
import { calculateQuote } from "@/domain/commerce";
import { createOrderIntakeInDatabase, type OrderIntakePayload } from "@/server/services/order-intake";
import { getPortalSnapshot } from "@/server/services/portal";
import { hashPortalToken } from "@/server/crypto";
import { getTradeDocumentSnapshot } from "@/server/services/documents";
import { generateTradeDocumentFromSnapshot } from "@/domain/documents";
import { PDFDocument } from "pdf-lib";
import { seedDemoDatabase } from "@/db/seed";
import type { AppDatabase } from "@/db/client";
import { getSharedWorkspaceProjection } from "@/server/services/workspace";
import { TENANT_ID } from "@/domain/seed";
import { advanceMilestoneInDatabase } from "@/server/services/milestones";
import { issuePortalGrantInDatabase } from "@/server/services/portal-grants";

const orgA = "org-inventory-a";
const orgB = "org-inventory-b";
const actor = (organizationId: string): RequestContext => ({
  organizationId,
  userId: `user-${organizationId}`,
  role: "OPS",
  actorType: "USER",
  mode: "database",
});

let client: PGlite;
let database: PgliteDatabase<typeof schema>;

async function seedOrganization(organizationId: string, reserved = 20) {
  await database.insert(schema.organizations).values({ id: organizationId, slug: organizationId, name: organizationId });
  await database.insert(schema.products).values({
    id: `product-${organizationId}`,
    organizationId,
    sku: "SKU-ATOMIC",
    name: "Atomic Inventory Fixture",
    category: "Test",
  });
  await database.insert(schema.inventoryBalances).values({
    id: `balance-${organizationId}`,
    organizationId,
    productId: `product-${organizationId}`,
    warehouseCode: "WH-1",
    onHand: 100,
    reserved,
    safetyStock: 10,
    version: 4,
  });
}

beforeEach(async () => {
  client = new PGlite();
  database = drizzle(client, { schema, casing: "snake_case" });
  await migrate(database, { migrationsFolder: "drizzle" });
  await seedOrganization(orgA);
  await seedOrganization(orgB, 5);
});

afterEach(async () => {
  await client.close();
});

const execute = (query: Parameters<typeof database.execute>[0]) => database.execute(query);

function orderIntakePayload(requestId = "REQ-INTAKE-001"): OrderIntakePayload {
  const quote = {
    quoteNumber: `QT-${requestId}`,
    validUntil: "2026-09-30",
    currency: "USD" as const,
    incoterm: "FOB" as const,
    lines: [{ sku: "SKU-ATOMIC", quantity: 10, unitPrice: 100, unitCostCny: 100, weightKg: 1 }],
    exchangeRates: { USD: 1, EUR: 0.9, CNY: 7.2 },
    discountRate: 0,
    freightUsd: 0,
    insuranceRate: 0,
    dutyRate: 0,
    commissionRate: 0.01,
    overheadUsd: 10,
  };
  return {
    requestId,
    company: { legalName: `Intake Buyer ${requestId}`, countryCode: "DE", industry: "Distribution", attributes: {} },
    lead: {
      sourceKey: `source-${requestId}`,
      score: 92,
      contact: { email: "buyer@example.invalid" },
      productsWanted: ["Test"],
      scoreReasons: ["Strong fit"],
      provenance: [{ source: "integration-test", observedAt: "2026-08-09T00:00:00.000Z" }],
    },
    dueDiligence: {
      tier: "LOW",
      riskScore: 12,
      registration: "ACTIVE",
      sanctionsScreen: "CLEAR",
      adverseMedia: "NONE",
      humanReviewRequired: false,
      flags: [],
      evidence: [{ source: "registry", result: "active" }],
    },
    customer: { segment: "GROWTH", creditLimitUsd: 50_000, paymentTerms: "30% deposit", tags: ["integration"] },
    quote: {
      ...quote,
      pricingResult: calculateQuote({ id: quote.quoteNumber, customerId: "pending", ...quote }),
    },
    order: {
      orderNumber: `SO-${requestId}`,
      customerPoNumber: `PO-${requestId}`,
      destination: "Hamburg, Germany",
      estimatedDeparture: "2026-09-01",
      estimatedArrival: "2026-09-30",
      container: "LCL",
    },
  };
}

async function seedPortal(organizationId: string, token: string, expiresAt = "2099-01-01T00:00:00.000Z") {
  const companyId = `portal-company-${organizationId}`;
  const customerId = `portal-customer-${organizationId}`;
  const orderId = `portal-order-${organizationId}`;
  const shipmentId = `portal-shipment-${organizationId}`;
  await database.insert(schema.companies).values({
    id: companyId,
    organizationId,
    kind: "CUSTOMER",
    legalName: `Portal Buyer ${organizationId}`,
    countryCode: "DE",
  });
  await database.insert(schema.customers).values({
    id: customerId,
    organizationId,
    companyId,
    paymentTerms: "Prepayment",
  });
  await database.insert(schema.salesOrders).values({
    id: orderId,
    organizationId,
    orderNumber: `SO-PORTAL-${organizationId}`,
    customerId,
    stage: "IN_TRANSIT",
    currency: "USD",
    incoterm: "CIF",
    amountUsd: 12_000,
    destination: "Hamburg, Germany",
    estimatedDeparture: "2026-09-01",
    estimatedArrival: "2026-09-30",
    container: "LCL",
  });
  await database.insert(schema.shipments).values({
    id: shipmentId,
    organizationId,
    salesOrderId: orderId,
    reference: `SHIP-PORTAL-${organizationId}`,
  });
  await database.insert(schema.shipmentMilestones).values({
    id: `portal-milestone-${organizationId}`,
    organizationId,
    shipmentId,
    sequence: 1,
    kind: "DEPARTURE",
    label: "Departure",
    status: "CURRENT",
    customerMessage: "Cargo departed on schedule.",
    evidence: { summary: "Carrier event received" },
  });
  await database.insert(schema.portalGrants).values({
    id: `portal-grant-${organizationId}`,
    organizationId,
    customerId,
    salesOrderId: orderId,
    tokenHash: hashPortalToken(token),
    expiresAt,
  });
}

async function seedMilestoneOrder(organizationId: string, orderNumber = "SO-MILESTONE-SHARED") {
  const companyId = `milestone-company-${organizationId}`;
  const customerId = `milestone-customer-${organizationId}`;
  const orderId = `milestone-order-${organizationId}`;
  const shipmentId = `milestone-shipment-${organizationId}`;
  await database.insert(schema.companies).values({
    id: companyId,
    organizationId,
    kind: "CUSTOMER",
    legalName: `Milestone Buyer ${organizationId}`,
    countryCode: "DE",
  });
  await database.insert(schema.customers).values({
    id: customerId,
    organizationId,
    companyId,
    paymentTerms: "Prepayment",
  });
  await database.insert(schema.salesOrders).values({
    id: orderId,
    organizationId,
    orderNumber,
    customerId,
    stage: "SIGNED",
    currency: "USD",
    incoterm: "FOB",
    amountUsd: 25_000,
    destination: "Hamburg, Germany",
  });
  await database.insert(schema.shipments).values({
    id: shipmentId,
    organizationId,
    salesOrderId: orderId,
    reference: `SHIP-MILESTONE-${organizationId}`,
  });
  await database.insert(schema.shipmentMilestones).values([
    {
      id: `milestone-1-${organizationId}`,
      organizationId,
      shipmentId,
      sequence: 1,
      kind: "PRODUCTION_RELEASE",
      label: "Production release",
      status: "CURRENT",
    },
    {
      id: `milestone-2-${organizationId}`,
      organizationId,
      shipmentId,
      sequence: 2,
      kind: "VESSEL_BOOKING",
      label: "Vessel booking",
      status: "UPCOMING",
    },
    {
      id: `milestone-3-${organizationId}`,
      organizationId,
      shipmentId,
      sequence: 3,
      kind: "DELIVERY",
      label: "Delivery",
      status: "UPCOMING",
    },
  ]);
  return { orderId, orderNumber, shipmentId };
}

describe("database inventory transaction", () => {
  it("commits inventory, movement, audit, outbox, and idempotency in one reservation", async () => {
    const result = await reserveInventoryInDatabase(execute, actor(orgA), {
      requestId: "REQ-ATOMIC-1",
      sku: "SKU-ATOMIC",
      quantity: 12,
      expectedVersion: 4,
      warehouseCode: "WH-1",
    });

    expect(result).toMatchObject({ status: "RESERVED", availableBefore: 70, availableAfter: 58, balanceVersion: 5 });
    const balance = await database.query.inventoryBalances.findFirst({ where: eq(schema.inventoryBalances.organizationId, orgA) });
    expect(balance).toMatchObject({ reserved: 32, version: 5 });
    await expect(database.select({ value: count() }).from(schema.stockMovements)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.auditEvents)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.outboxMessages)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.idempotencyRecords)).resolves.toEqual([{ value: 1 }]);
  });

  it("replays the same request without creating duplicate side effects", async () => {
    const request = { requestId: "REQ-REPLAY-1", sku: "SKU-ATOMIC", quantity: 8, expectedVersion: 4 };
    const first = await reserveInventoryInDatabase(execute, actor(orgA), request);
    const replay = await reserveInventoryInDatabase(execute, actor(orgA), request);

    expect(first.status).toBe("RESERVED");
    expect(replay).toMatchObject({ status: "IDEMPOTENT_REPLAY", reservationId: first.reservationId });
    await expect(database.select({ value: count() }).from(schema.stockReservations)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.stockMovements)).resolves.toEqual([{ value: 1 }]);
  });

  it("rejects reusing an idempotency key with a different payload", async () => {
    await reserveInventoryInDatabase(execute, actor(orgA), { requestId: "REQ-CONFLICT-1", sku: "SKU-ATOMIC", quantity: 8 });
    const conflict = await reserveInventoryInDatabase(execute, actor(orgA), { requestId: "REQ-CONFLICT-1", sku: "SKU-ATOMIC", quantity: 9 });
    expect(conflict.status).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("rejects stale versions and makes the rejection idempotent", async () => {
    const request = { requestId: "REQ-STALE-1", sku: "SKU-ATOMIC", quantity: 1, expectedVersion: 3 };
    const first = await reserveInventoryInDatabase(execute, actor(orgA), request);
    const replay = await reserveInventoryInDatabase(execute, actor(orgA), request);
    expect(first).toMatchObject({ status: "REJECTED", balanceVersion: 4 });
    expect(replay).toEqual(first);
  });

  it("prevents concurrent oversell", async () => {
    const [first, second] = await Promise.all([
      reserveInventoryInDatabase(execute, actor(orgA), { requestId: "REQ-RACE-1", sku: "SKU-ATOMIC", quantity: 50 }),
      reserveInventoryInDatabase(execute, actor(orgA), { requestId: "REQ-RACE-2", sku: "SKU-ATOMIC", quantity: 50 }),
    ]);
    expect([first.status, second.status].sort()).toEqual(["REJECTED", "RESERVED"]);
    const balance = await database.query.inventoryBalances.findFirst({ where: eq(schema.inventoryBalances.organizationId, orgA) });
    expect(balance?.reserved).toBe(70);
  });

  it("never crosses the organization boundary for the same SKU", async () => {
    await reserveInventoryInDatabase(execute, actor(orgA), { requestId: "REQ-TENANT-1", sku: "SKU-ATOMIC", quantity: 10 });
    const other = await database.query.inventoryBalances.findFirst({ where: eq(schema.inventoryBalances.organizationId, orgB) });
    expect(other).toMatchObject({ reserved: 5, version: 4 });
  });
});

describe("database lead-to-order vertical transaction", () => {
  it("atomically creates lead, diligence, customer, quote, order, audit, and outbox", async () => {
    const result = await createOrderIntakeInDatabase(execute, actor(orgA), orderIntakePayload());
    expect(result).toMatchObject({ status: "CREATED", requestId: "REQ-INTAKE-001" });
    expect(result.leadId).toBeTruthy();
    expect(result.customerId).toBeTruthy();
    expect(result.quoteId).toBeTruthy();
    expect(result.orderId).toBeTruthy();

    await expect(database.select({ value: count() }).from(schema.leads)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.dueDiligenceCases)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.customers)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.quotes)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.salesOrders)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.auditEvents)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.outboxMessages)).resolves.toEqual([{ value: 1 }]);
  });

  it("replays a complete intake without duplicating any business row", async () => {
    const payload = orderIntakePayload("REQ-INTAKE-REPLAY");
    const first = await createOrderIntakeInDatabase(execute, actor(orgA), payload);
    const replay = await createOrderIntakeInDatabase(execute, actor(orgA), payload);
    expect(first.status).toBe("CREATED");
    expect(replay).toMatchObject({ status: "IDEMPOTENT_REPLAY", orderId: first.orderId });
    await expect(database.select({ value: count() }).from(schema.salesOrders)).resolves.toEqual([{ value: 1 }]);
  });

  it("stops after diligence and holds high-risk intake before customer or order creation", async () => {
    const payload = orderIntakePayload("REQ-INTAKE-HELD");
    payload.dueDiligence.tier = "HIGH";
    payload.dueDiligence.humanReviewRequired = true;
    const result = await createOrderIntakeInDatabase(execute, actor(orgA), payload);
    expect(result).toMatchObject({ status: "HELD_FOR_REVIEW", customerId: null, quoteId: null, orderId: null });
    await expect(database.select({ value: count() }).from(schema.leads)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.customers)).resolves.toEqual([{ value: 0 }]);
    await expect(database.select({ value: count() }).from(schema.salesOrders)).resolves.toEqual([{ value: 0 }]);
    const message = await database.query.outboxMessages.findFirst();
    expect(message).toMatchObject({ topic: "compliance.review.required", status: "HELD" });
  });

  it("allows the same business references in a different organization without data crossing", async () => {
    const payload = orderIntakePayload("REQ-INTAKE-TENANT");
    const first = await createOrderIntakeInDatabase(execute, actor(orgA), payload);
    const second = await createOrderIntakeInDatabase(execute, actor(orgB), payload);
    expect(first.status).toBe("CREATED");
    expect(second.status).toBe("CREATED");
    expect(second.orderId).not.toBe(first.orderId);
    const rows = await database.select({ organizationId: schema.salesOrders.organizationId }).from(schema.salesOrders);
    expect(rows.map((row) => row.organizationId).sort()).toEqual([orgA, orgB]);
  });
});

describe("database customer portal boundary", () => {
  it("loads only a valid, unexpired token and returns a cost-redacted projection", async () => {
    await seedPortal(orgA, "secret-portal-token");
    const snapshot = await getPortalSnapshot(execute, "secret-portal-token");
    expect(snapshot).toMatchObject({
      company: `Portal Buyer ${orgA}`,
      orderId: `SO-PORTAL-${orgA}`,
      stage: "IN_TRANSIT",
    });
    expect(snapshot?.milestones).toHaveLength(1);
    expect(JSON.stringify(snapshot)).not.toMatch(/amountUsd|supplier|margin|unitCost/i);
    const grant = await database.query.portalGrants.findFirst({ where: eq(schema.portalGrants.organizationId, orgA) });
    expect(grant?.lastAccessedAt).toBeTruthy();
  });

  it("rejects unknown and expired tokens without falling back to another order", async () => {
    await seedPortal(orgA, "expired-token", "2020-01-01T00:00:00.000Z");
    await expect(getPortalSnapshot(execute, "unknown-token")).resolves.toBeNull();
    await expect(getPortalSnapshot(execute, "expired-token")).resolves.toBeNull();
  });

  it("binds each token to exactly one organization", async () => {
    await seedPortal(orgA, "org-a-token");
    await seedPortal(orgB, "org-b-token");
    const snapshot = await getPortalSnapshot(execute, "org-b-token");
    expect(snapshot?.company).toBe(`Portal Buyer ${orgB}`);
    expect(snapshot?.company).not.toContain(orgA);
  });
});

describe("database shipment milestone transaction", () => {
  it("advances the timeline, order stage, audit chain, outbox draft, and idempotency atomically", async () => {
    const seeded = await seedMilestoneOrder(orgA);
    const request = { requestId: "REQ-MILESTONE-ATOMIC-1", orderId: seeded.orderNumber };
    const first = await advanceMilestoneInDatabase(execute, actor(orgA), request);
    const replay = await advanceMilestoneInDatabase(execute, actor(orgA), request);

    expect(first).toMatchObject({
      status: "ADVANCED",
      orderId: seeded.orderId,
      completedMilestoneId: `milestone-1-${orgA}`,
      nextMilestoneId: `milestone-2-${orgA}`,
      orderStage: "BOOKED",
    });
    expect(replay).toMatchObject({
      status: "IDEMPOTENT_REPLAY",
      orderId: first.orderId,
      completedMilestoneId: first.completedMilestoneId,
      nextMilestoneId: first.nextMilestoneId,
      orderStage: first.orderStage,
    });
    const milestones = await database.select().from(schema.shipmentMilestones)
      .where(eq(schema.shipmentMilestones.organizationId, orgA))
      .orderBy(asc(schema.shipmentMilestones.sequence));
    expect(milestones.map((item) => item.status)).toEqual(["DONE", "CURRENT", "UPCOMING"]);
    expect(milestones[0].actualAt).toBeTruthy();
    const order = await database.query.salesOrders.findFirst({ where: eq(schema.salesOrders.id, seeded.orderId) });
    expect(order).toMatchObject({ stage: "BOOKED", version: 2 });
    await expect(database.select({ value: count() }).from(schema.auditEvents)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.outboxMessages)).resolves.toEqual([{ value: 1 }]);
    await expect(database.select({ value: count() }).from(schema.idempotencyRecords)).resolves.toEqual([{ value: 1 }]);
    const draft = await database.query.outboxMessages.findFirst();
    expect(draft).toMatchObject({ topic: "customer.milestone-update.draft", status: "HELD" });
  });

  it("completes the final milestone without silently sending a customer message", async () => {
    const seeded = await seedMilestoneOrder(orgA);
    await advanceMilestoneInDatabase(execute, actor(orgA), { requestId: "REQ-MILESTONE-STEP-1", orderId: seeded.orderId });
    await advanceMilestoneInDatabase(execute, actor(orgA), { requestId: "REQ-MILESTONE-STEP-2", orderId: seeded.orderId });
    const completed = await advanceMilestoneInDatabase(execute, actor(orgA), { requestId: "REQ-MILESTONE-STEP-3", orderId: seeded.orderId });

    expect(completed).toMatchObject({ status: "COMPLETED", nextMilestoneId: null, orderStage: "DELIVERED" });
    const order = await database.query.salesOrders.findFirst({ where: eq(schema.salesOrders.id, seeded.orderId) });
    expect(order?.stage).toBe("DELIVERED");
    const messages = await database.select().from(schema.outboxMessages);
    expect(messages).toHaveLength(3);
    expect(messages.every((message) => message.status === "HELD")).toBe(true);
  });

  it("cannot advance an order belonging to another organization", async () => {
    const seeded = await seedMilestoneOrder(orgA);
    const result = await advanceMilestoneInDatabase(execute, actor(orgB), {
      requestId: "REQ-MILESTONE-CROSS-TENANT",
      orderId: seeded.orderId,
    });
    expect(result).toMatchObject({ status: "NOT_FOUND", orderId: null });
    const milestone = await database.query.shipmentMilestones.findFirst({
      where: eq(schema.shipmentMilestones.id, `milestone-1-${orgA}`),
    });
    expect(milestone).toMatchObject({ status: "CURRENT", actualAt: null });
  });
});

describe("database portal grant issuance", () => {
  const portalSecret = "test-only-portal-secret-with-more-than-thirty-two-characters";

  it("issues a retry-safe token while persisting only its hash", async () => {
    const seeded = await seedMilestoneOrder(orgA);
    const request = { requestId: "REQ-PORTAL-ISSUE-001", orderId: seeded.orderId, expiresInHours: 168 };
    const first = await issuePortalGrantInDatabase(execute, actor(orgA), request, portalSecret);
    const replay = await issuePortalGrantInDatabase(execute, actor(orgA), request, portalSecret);

    expect(first).toMatchObject({ status: "CREATED", orderId: seeded.orderId, customerId: `milestone-customer-${orgA}` });
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(replay).toMatchObject({ status: "IDEMPOTENT_REPLAY", grantId: first.grantId, token: first.token });
    const grant = await database.query.portalGrants.findFirst({ where: eq(schema.portalGrants.id, first.grantId!) });
    expect(grant?.tokenHash).toBe(hashPortalToken(first.token!));
    expect(JSON.stringify(grant)).not.toContain(first.token!);
    const snapshot = await getPortalSnapshot(execute, first.token!);
    expect(snapshot).toMatchObject({ orderId: seeded.orderNumber, company: `Milestone Buyer ${orgA}` });
    const auditEvent = await database.query.auditEvents.findFirst();
    expect(auditEvent).toMatchObject({ action: "portal.grant.issued", entityId: seeded.orderId });
    expect(JSON.stringify(auditEvent)).not.toContain(first.token!);
    await expect(database.select({ value: count() }).from(schema.portalGrants)).resolves.toEqual([{ value: 1 }]);
  });

  it("rotates a portal grant and immediately invalidates the prior link", async () => {
    const seeded = await seedMilestoneOrder(orgA);
    const first = await issuePortalGrantInDatabase(execute, actor(orgA), {
      requestId: "REQ-PORTAL-ROTATE-001",
      orderId: seeded.orderId,
      expiresInHours: 168,
    }, portalSecret);
    const second = await issuePortalGrantInDatabase(execute, actor(orgA), {
      requestId: "REQ-PORTAL-ROTATE-002",
      orderId: seeded.orderId,
      expiresInHours: 24,
    }, portalSecret);

    expect(second).toMatchObject({ status: "CREATED", orderId: seeded.orderId });
    expect(second.token).not.toBe(first.token);
    await expect(getPortalSnapshot(execute, first.token!)).resolves.toBeNull();
    await expect(getPortalSnapshot(execute, second.token!)).resolves.toMatchObject({ orderId: seeded.orderNumber });
    const grants = await database.select().from(schema.portalGrants).orderBy(asc(schema.portalGrants.createdAt));
    expect(grants).toHaveLength(2);
    expect(grants.filter((grant) => grant.status === "ACTIVE")).toHaveLength(1);
    expect(grants.find((grant) => grant.id === first.grantId)).toMatchObject({ status: "REVOKED" });
  });

  it("rejects idempotency changes and cross-organization order references", async () => {
    const seeded = await seedMilestoneOrder(orgA);
    const requestId = "REQ-PORTAL-CONFLICT-001";
    await issuePortalGrantInDatabase(execute, actor(orgA), { requestId, orderId: seeded.orderId, expiresInHours: 168 }, portalSecret);
    const conflict = await issuePortalGrantInDatabase(execute, actor(orgA), { requestId, orderId: seeded.orderId, expiresInHours: 24 }, portalSecret);
    const crossTenant = await issuePortalGrantInDatabase(execute, actor(orgB), {
      requestId: "REQ-PORTAL-CROSS-TENANT",
      orderId: seeded.orderId,
      expiresInHours: 168,
    }, portalSecret);

    expect(conflict).toMatchObject({ status: "IDEMPOTENCY_CONFLICT", token: null });
    expect(crossTenant).toMatchObject({ status: "NOT_FOUND", grantId: null, token: null });
  });
});

describe("database trade-document projection", () => {
  it("generates a controlled PDF from the authenticated organization instead of fixtures", async () => {
    const intake = await createOrderIntakeInDatabase(execute, actor(orgA), orderIntakePayload("REQ-DOCUMENT-DB"));
    const snapshot = await getTradeDocumentSnapshot(execute, actor(orgA), intake.orderId!);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.synthetic).toBe(false);
    expect(snapshot?.order.id).toBe("SO-REQ-DOCUMENT-DB");

    const bytes = await generateTradeDocumentFromSnapshot("commercial-invoice", snapshot!);
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toContain("COMMERCIAL INVOICE");
    expect(pdf.getSubject()).toMatch(/not for filing/i);
  });

  it("returns no document snapshot across an organization boundary", async () => {
    const intake = await createOrderIntakeInDatabase(execute, actor(orgA), orderIntakePayload("REQ-DOCUMENT-TENANT"));
    await expect(getTradeDocumentSnapshot(execute, actor(orgB), intake.orderId!)).resolves.toBeNull();
  });
});

describe("shared operator workspace projection", () => {
  it("hydrates all core workspaces from organization-scoped database records", async () => {
    await seedDemoDatabase(database as unknown as AppDatabase, { portalToken: "workspace-portal-token" });
    const projection = await getSharedWorkspaceProjection(database as unknown as AppDatabase, actor(TENANT_ID));
    expect(projection.auditLinked).toBe(true);
    expect(projection.state).toMatchObject({
      tenantId: TENANT_ID,
      schemaVersion: 3,
    });
    expect(projection.state.leads).toHaveLength(8);
    expect(projection.state.customers).toHaveLength(4);
    expect(projection.state.products).toHaveLength(8);
    expect(projection.state.suppliers).toHaveLength(5);
    expect(projection.state.inventory).toHaveLength(8);
    expect(projection.state.quotes).toHaveLength(2);
    expect(projection.state.orders).toHaveLength(3);
    expect(projection.state.ledgers).toHaveLength(3);
  });
});
