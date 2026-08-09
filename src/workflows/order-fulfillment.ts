export interface OrderWorkflowInput {
  orderId: string;
  tenantId: string;
  customerId: string;
  dryRun: true;
}

export interface OrderWorkflowResult {
  orderId: string;
  status: "READY_FOR_CONTROLLED_EXECUTION";
  dryRun: true;
  completedSteps: string[];
  outboxMessageId: string;
}

export async function validateOrder(input: OrderWorkflowInput) {
  "use step";
  if (!input.orderId.startsWith("SO-")) throw new Error("Invalid synthetic order identifier");
  if (!input.dryRun) throw new Error("Level 10 public demo only permits dry-run workflows");
  return { accepted: true, policy: "SYNTHETIC_DEMO_ONLY", orderId: input.orderId };
}

export async function reserveStockStep(input: OrderWorkflowInput) {
  "use step";
  return { reservationId: `RSV-${input.orderId}`, mode: "SIMULATED_ATOMIC", oversellGuard: true };
}

export async function prepareDocumentsStep(input: OrderWorkflowInput) {
  "use step";
  return { documentSetId: `DOCSET-${input.orderId}`, count: 8, filingStatus: "DRAFT_NOT_FILED" };
}

export async function buildMilestonePlanStep(input: OrderWorkflowInput) {
  "use step";
  return { planId: `PLAN-${input.orderId}`, milestones: 8, customerVisibility: "COST_REDACTED" };
}

export async function placeCustomerUpdateInOutbox(input: OrderWorkflowInput) {
  "use step";
  return { messageId: `OUTBOX-${input.orderId}`, delivery: "DRAFT_ONLY", realMessageSent: false };
}

export async function orderFulfillmentWorkflow(input: OrderWorkflowInput): Promise<OrderWorkflowResult> {
  "use workflow";
  const validation = await validateOrder(input);
  const reservation = await reserveStockStep(input);
  const documents = await prepareDocumentsStep(input);
  const milestones = await buildMilestonePlanStep(input);
  const outbox = await placeCustomerUpdateInOutbox(input);

  return {
    orderId: input.orderId,
    status: "READY_FOR_CONTROLLED_EXECUTION",
    dryRun: true,
    completedSteps: [validation.policy, reservation.mode, documents.filingStatus, milestones.customerVisibility],
    outboxMessageId: outbox.messageId,
  };
}
