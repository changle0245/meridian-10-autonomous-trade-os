import { describe, expect, it } from "vitest";
import { buildMilestonePlanStep, placeCustomerUpdateInOutbox, prepareDocumentsStep, reserveStockStep, validateOrder } from "@/workflows/order-fulfillment";

const input = { orderId: "SO-260731", tenantId: "tenant-meridian-demo", customerId: "CUS-2401", dryRun: true as const };

describe("durable order workflow steps", () => {
  it("validates the synthetic-only execution boundary", async () => {
    await expect(validateOrder(input)).resolves.toEqual({ accepted: true, policy: "SYNTHETIC_DEMO_ONLY", orderId: input.orderId });
  });

  it("rejects invalid order identifiers", async () => {
    await expect(validateOrder({ ...input, orderId: "BAD" })).rejects.toThrow(/Invalid/);
  });

  it("creates a simulated atomic reservation", async () => {
    const result = await reserveStockStep(input);
    expect(result.oversellGuard).toBe(true);
    expect(result.mode).toBe("SIMULATED_ATOMIC");
  });

  it("prepares eight draft trade documents", async () => {
    const result = await prepareDocumentsStep(input);
    expect(result.count).toBe(8);
    expect(result.filingStatus).toBe("DRAFT_NOT_FILED");
  });

  it("creates an eight-step cost-redacted milestone plan", async () => {
    const result = await buildMilestonePlanStep(input);
    expect(result.milestones).toBe(8);
    expect(result.customerVisibility).toBe("COST_REDACTED");
  });

  it("never sends a real customer message", async () => {
    const result = await placeCustomerUpdateInOutbox(input);
    expect(result.delivery).toBe("DRAFT_ONLY");
    expect(result.realMessageSent).toBe(false);
  });
});
