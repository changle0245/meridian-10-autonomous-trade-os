import { describe, expect, it } from "vitest";
import { calculateProfit, calculateQuote, inventoryHealth, reserveInventory, stressLedger } from "@/domain/commerce";
import { inventory, ledgers, quotes } from "@/domain/seed";
import type { Incoterm, QuoteInput } from "@/domain/types";

describe("landed-cost quotation engine", () => {
  it.each(["EXW", "FOB", "CIF", "DDP"] as Incoterm[])("calculates a finite %s quote", (incoterm) => {
    const result = calculateQuote({ ...quotes[0], incoterm });
    expect(Number.isFinite(result.customerTotal)).toBe(true);
    expect(result.revenueUsd).toBeGreaterThan(0);
    expect(result.landedCostUsd).toBeGreaterThan(0);
    expect(["PASS", "REVIEW", "BLOCK"]).toContain(result.guardrail);
  });

  it("adds freight and insurance only for CIF or DDP", () => {
    expect(calculateQuote({ ...quotes[0], incoterm: "FOB" }).freightUsd).toBe(0);
    expect(calculateQuote({ ...quotes[0], incoterm: "CIF" }).freightUsd).toBe(quotes[0].freightUsd);
    expect(calculateQuote({ ...quotes[0], incoterm: "CIF" }).insuranceUsd).toBeGreaterThan(0);
  });

  it("adds duty only for DDP", () => {
    expect(calculateQuote({ ...quotes[0], incoterm: "CIF" }).dutyUsd).toBe(0);
    expect(calculateQuote({ ...quotes[0], incoterm: "DDP" }).dutyUsd).toBeGreaterThan(0);
  });

  it("returns the selected customer currency", () => {
    const eur = calculateQuote(quotes[0]);
    const usd = calculateQuote({ ...quotes[0], currency: "USD" });
    expect(eur.currency).toBe("EUR");
    expect(eur.customerTotal).toBeCloseTo(eur.revenueUsd * quotes[0].exchangeRates.EUR, 1);
    expect(usd.customerTotal).toBeCloseTo(usd.revenueUsd, 1);
  });

  it.each([0, 0.025, 0.08, 0.13, 0.2])("discount %.3f monotonically lowers revenue", (discount) => {
    const result = calculateQuote({ ...quotes[0], discountRate: discount });
    const baseline = calculateQuote({ ...quotes[0], discountRate: 0 });
    expect(result.revenueUsd).toBeLessThanOrEqual(baseline.revenueUsd);
  });

  it("blocks a deeply discounted loss-making quote", () => {
    const input: QuoteInput = { ...quotes[0], discountRate: 0.49, lines: quotes[0].lines.map((line) => ({ ...line, unitPrice: line.unitPrice * 0.45 })) };
    const result = calculateQuote(input);
    expect(result.guardrail).toBe("BLOCK");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects an empty quote", () => {
    expect(() => calculateQuote({ ...quotes[0], lines: [] })).toThrow(/at least one line/);
  });

  it("rejects out-of-policy discounts", () => {
    expect(() => calculateQuote({ ...quotes[0], discountRate: 0.5 })).toThrow(/Discount/);
  });

  it("warns when DDP duty is missing", () => {
    const result = calculateQuote({ ...quotes[0], incoterm: "DDP", dutyRate: 0 });
    expect(result.warnings.join(" ")).toMatch(/duty/);
  });
});

describe("order profitability", () => {
  it.each(ledgers)("reconciles $orderId revenue to costs and profit", (ledger) => {
    const result = calculateProfit(ledger);
    expect(result.netProfitUsd).toBeCloseTo(ledger.revenueUsd - result.totalCostUsd, 1);
    expect(result.netMargin).toBeCloseTo(result.netProfitUsd / ledger.revenueUsd, 3);
    expect(result.contributionMargin).toBeGreaterThan(-1);
  });

  it("models freight stress without mutating the baseline", () => {
    const before = structuredClone(ledgers[0]);
    const stressed = stressLedger(ledgers[0], { cnyWeakeningRate: 0, freightIncreaseRate: 0.5 });
    expect(stressed.freightUsd).toBe(ledgers[0].freightUsd * 1.5);
    expect(ledgers[0]).toEqual(before);
    expect(calculateProfit(stressed).netProfitUsd).toBeLessThan(calculateProfit(ledgers[0]).netProfitUsd);
  });

  it("models CNY weakening as a lower USD procurement cost", () => {
    const stressed = stressLedger(ledgers[0], { cnyWeakeningRate: 0.1, freightIncreaseRate: 0 });
    expect(stressed.procurementUsd).toBeLessThan(ledgers[0].procurementUsd);
  });
});

describe("inventory transaction safety", () => {
  it("accepts an in-policy atomic reservation", () => {
    const item = inventory[0];
    const result = reserveInventory(inventory, { requestId: "R-OK", sku: item.sku, quantity: 25, expectedVersion: item.version });
    expect(result.status).toBe("RESERVED");
    expect(result.availableAfter).toBe(result.availableBefore - 25);
    expect(result.inventory[0].version).toBe(item.version + 1);
    expect(inventory[0].reserved).toBe(item.reserved);
  });

  it("prevents overselling below safety stock", () => {
    const item = inventory[0];
    const quantity = item.onHand - item.reserved - item.safetyStock + 1;
    const result = reserveInventory(inventory, { requestId: "R-OVER", sku: item.sku, quantity });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toMatch(/Oversell prevented/);
  });

  it("rejects stale optimistic-lock versions", () => {
    const item = inventory[0];
    const result = reserveInventory(inventory, { requestId: "R-STALE", sku: item.sku, quantity: 1, expectedVersion: item.version - 1 });
    expect(result.status).toBe("REJECTED");
    expect(result.reason).toMatch(/Version conflict/);
  });

  it("turns a duplicate request into an idempotent no-op", () => {
    const result = reserveInventory(inventory, { requestId: "R-REPLAY", sku: inventory[0].sku, quantity: 25 }, new Set(["R-REPLAY"]));
    expect(result.status).toBe("IDEMPOTENT_REPLAY");
    expect(result.inventory).toBe(inventory);
  });

  it.each([0, -1, 1.2])("rejects invalid quantity %s", (quantity) => {
    const result = reserveInventory(inventory, { requestId: `R-${quantity}`, sku: inventory[0].sku, quantity });
    expect(result.status).toBe("REJECTED");
  });

  it("throws for an unknown SKU", () => {
    expect(() => reserveInventory(inventory, { requestId: "R-404", sku: "MISSING", quantity: 1 })).toThrow(/Unknown SKU/);
  });

  it.each(inventory)("computes coherent health for $sku", (item) => {
    const health = inventoryHealth(item);
    expect(health.available).toBe(item.onHand - item.reserved);
    expect(health.projected).toBe(health.available + item.inProduction + item.inbound);
  });
});
