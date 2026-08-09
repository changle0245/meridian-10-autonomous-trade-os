import { and, eq, or } from "drizzle-orm";
import { FatalError, getStepMetadata } from "workflow";
import { getDatabase } from "@/db/client";
import {
  documentVersions,
  outboxMessages,
  products,
  salesOrderLines,
  salesOrders,
  shipmentMilestones,
  shipments,
  workflowRuns,
} from "@/db/schema";
import { orders as fixtureOrders } from "@/domain/seed";
import type { DocumentType } from "@/domain/types";
import type { RequestContext } from "@/server/auth/context";
import { sha256 } from "@/server/crypto";
import { reserveInventoryInDatabase } from "@/server/services/inventory";

export interface OrderWorkflowInput {
  orderId: string;
  organizationId?: string;
  actorId?: string;
  workflowRecordId?: string;
  mode?: "fixture" | "database";
  tenantId?: string;
  customerId?: string;
  dryRun: boolean;
}

export interface OrderWorkflowResult {
  orderId: string;
  status: "READY_FOR_CONTROLLED_EXECUTION";
  dryRun: boolean;
  completedSteps: string[];
  outboxMessageId: string;
}

function databaseContext(input: OrderWorkflowInput): RequestContext {
  if (!input.organizationId || !input.actorId) throw new FatalError("Database workflow is missing trusted actor context");
  return {
    organizationId: input.organizationId,
    userId: input.actorId,
    role: "OPS",
    actorType: "SYSTEM",
    mode: "database",
  };
}

export async function validateOrder(input: OrderWorkflowInput) {
  "use step";
  if (input.mode !== "database") {
    if (!input.orderId.startsWith("SO-")) throw new Error("Invalid synthetic order identifier");
    if (!input.dryRun) throw new Error("Fixture mode only permits dry-run workflows");
    if (!fixtureOrders.some((order) => order.id === input.orderId)) throw new FatalError("Unknown synthetic order");
    return { accepted: true, policy: "SYNTHETIC_DEMO_ONLY", orderId: input.orderId };
  }

  const context = databaseContext(input);
  const database = getDatabase();
  const [order] = await database.select({ id: salesOrders.id, stage: salesOrders.stage }).from(salesOrders).where(and(
    eq(salesOrders.organizationId, context.organizationId),
    or(eq(salesOrders.id, input.orderId), eq(salesOrders.orderNumber, input.orderId)),
  )).limit(1);
  if (!order) throw new FatalError("Order does not exist in the authenticated organization");
  if (order.stage === "CANCELLED" || order.stage === "DELIVERED") throw new FatalError(`Order stage ${order.stage} cannot start fulfillment`);
  return { accepted: true, policy: "TENANT_SCOPED_DATABASE", orderId: order.id };
}

export async function reserveStockStep(input: OrderWorkflowInput) {
  "use step";
  if (input.mode !== "database") {
    return { reservationId: `RSV-${input.orderId}`, mode: "SIMULATED_ATOMIC", oversellGuard: true };
  }

  const context = databaseContext(input);
  const { stepId } = getStepMetadata();
  const database = getDatabase();
  const lines = await database.select({
    lineId: salesOrderLines.id,
    sku: products.sku,
    quantity: salesOrderLines.quantity,
  }).from(salesOrderLines)
    .innerJoin(products, and(eq(products.id, salesOrderLines.productId), eq(products.organizationId, context.organizationId)))
    .where(and(eq(salesOrderLines.organizationId, context.organizationId), eq(salesOrderLines.orderId, input.orderId)));
  if (lines.length === 0) throw new FatalError("Order has no reservable lines");

  const reservations = [];
  for (const line of lines) {
    const result = await reserveInventoryInDatabase(
      (query) => database.execute(query),
      context,
      { requestId: `${stepId}:${line.lineId}`, sku: line.sku, quantity: line.quantity, orderId: input.orderId },
    );
    if (result.status === "REJECTED" || result.status === "NOT_FOUND" || result.status === "IDEMPOTENCY_CONFLICT") {
      throw new FatalError(`Inventory policy stopped fulfillment: ${result.reason}`);
    }
    reservations.push(result.reservationId);
  }
  return { reservationId: reservations.join(","), mode: "DATABASE_ATOMIC", oversellGuard: true };
}

const documentTypes: DocumentType[] = [
  "quotation", "proforma-invoice", "commercial-invoice", "purchase-order",
  "packing-list", "customs-draft", "origin-draft", "shipping-update",
];

export async function prepareDocumentsStep(input: OrderWorkflowInput) {
  "use step";
  if (input.mode !== "database") {
    return { documentSetId: `DOCSET-${input.orderId}`, count: 8, filingStatus: "DRAFT_NOT_FILED" };
  }

  const context = databaseContext(input);
  const database = getDatabase();
  const [order] = await database.select({ orderNumber: salesOrders.orderNumber }).from(salesOrders).where(and(
    eq(salesOrders.organizationId, context.organizationId), eq(salesOrders.id, input.orderId),
  )).limit(1);
  if (!order) throw new FatalError("Order disappeared before document preparation");

  for (const type of documentTypes) {
    const documentNumber = `${order.orderNumber}-${type.toUpperCase()}`;
    await database.insert(documentVersions).values({
      id: `doc_${sha256(`${context.organizationId}:${documentNumber}:1`).slice(0, 24)}`,
      organizationId: context.organizationId,
      salesOrderId: input.orderId,
      documentType: type,
      documentNumber,
      version: 1,
      status: "DRAFT",
      contentHash: sha256(JSON.stringify({ organizationId: context.organizationId, orderId: input.orderId, type, version: 1 })),
      snapshot: { orderId: input.orderId, type, filingStatus: "DRAFT_NOT_FILED" },
    }).onConflictDoNothing();
  }
  return { documentSetId: `docset_${sha256(input.orderId).slice(0, 24)}`, count: documentTypes.length, filingStatus: "DRAFT_NOT_FILED" };
}

const milestonePlan = [
  "Production release", "Inline inspection", "Final inspection", "Vessel booking",
  "Export customs", "Departure", "Arrival", "Delivery",
];

export async function buildMilestonePlanStep(input: OrderWorkflowInput) {
  "use step";
  if (input.mode !== "database") {
    return { planId: `PLAN-${input.orderId}`, milestones: 8, customerVisibility: "COST_REDACTED" };
  }

  const context = databaseContext(input);
  const database = getDatabase();
  const [order] = await database.select({
    orderNumber: salesOrders.orderNumber,
    estimatedDeparture: salesOrders.estimatedDeparture,
    estimatedArrival: salesOrders.estimatedArrival,
  }).from(salesOrders).where(and(eq(salesOrders.organizationId, context.organizationId), eq(salesOrders.id, input.orderId))).limit(1);
  if (!order) throw new FatalError("Order disappeared before milestone planning");

  const shipmentId = `ship_${sha256(`${context.organizationId}:${input.orderId}`).slice(0, 24)}`;
  await database.insert(shipments).values({
    id: shipmentId,
    organizationId: context.organizationId,
    salesOrderId: input.orderId,
    reference: `SHIP-${order.orderNumber}`,
    status: "PLANNED",
    estimatedDeparture: order.estimatedDeparture ? `${order.estimatedDeparture}T00:00:00.000Z` : null,
    estimatedArrival: order.estimatedArrival ? `${order.estimatedArrival}T00:00:00.000Z` : null,
  }).onConflictDoNothing();
  for (const [index, label] of milestonePlan.entries()) {
    await database.insert(shipmentMilestones).values({
      id: `milestone_${sha256(`${shipmentId}:${index + 1}`).slice(0, 24)}`,
      organizationId: context.organizationId,
      shipmentId,
      sequence: index + 1,
      kind: label.toUpperCase().replaceAll(" ", "_"),
      label,
      status: index === 0 ? "CURRENT" : "UPCOMING",
      customerMessage: `${label} is part of the controlled fulfillment plan.`,
      evidence: {},
    }).onConflictDoNothing();
  }
  return { planId: shipmentId, milestones: milestonePlan.length, customerVisibility: "COST_REDACTED" };
}

export async function placeCustomerUpdateInOutbox(input: OrderWorkflowInput) {
  "use step";
  if (input.mode !== "database") {
    return { messageId: `OUTBOX-${input.orderId}`, delivery: "DRAFT_ONLY", realMessageSent: false };
  }

  const context = databaseContext(input);
  const { stepId } = getStepMetadata();
  const database = getDatabase();
  const messageId = `out_${sha256(stepId).slice(0, 24)}`;
  await database.insert(outboxMessages).values({
    id: messageId,
    organizationId: context.organizationId,
    topic: "customer.update.draft",
    aggregateType: "sales_order",
    aggregateId: input.orderId,
    deduplicationKey: `workflow:${stepId}`,
    payload: {
      orderId: input.orderId,
      message: "Your order fulfillment plan has been prepared.",
      redactions: ["supplier-cost", "internal-margin", "risk-notes"],
      realMessageSent: false,
    },
    status: "HELD",
  }).onConflictDoNothing();
  return { messageId, delivery: "DRAFT_ONLY", realMessageSent: false };
}

export async function finalizeWorkflowStep(input: OrderWorkflowInput) {
  "use step";
  if (input.mode === "database" && input.workflowRecordId) {
    const context = databaseContext(input);
    const database = getDatabase();
    await database.update(workflowRuns).set({
      status: "SUCCEEDED",
      output: { orderId: input.orderId, dryRun: false },
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(and(eq(workflowRuns.organizationId, context.organizationId), eq(workflowRuns.id, input.workflowRecordId)));
  }
  return { finalized: true };
}

export async function orderFulfillmentWorkflow(input: OrderWorkflowInput): Promise<OrderWorkflowResult> {
  "use workflow";
  const validation = await validateOrder(input);
  const scopedInput = { ...input, orderId: validation.orderId };
  const reservation = await reserveStockStep(scopedInput);
  const documents = await prepareDocumentsStep(scopedInput);
  const milestones = await buildMilestonePlanStep(scopedInput);
  const outbox = await placeCustomerUpdateInOutbox(scopedInput);
  await finalizeWorkflowStep(scopedInput);

  return {
    orderId: validation.orderId,
    status: "READY_FOR_CONTROLLED_EXECUTION",
    dryRun: input.mode !== "database",
    completedSteps: [validation.policy, reservation.mode, documents.filingStatus, milestones.customerVisibility],
    outboxMessageId: outbox.messageId,
  };
}
