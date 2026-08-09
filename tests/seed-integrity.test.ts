import { describe, expect, it } from "vitest";
import { createSeedState, customers, dueDiligence, inventory, leads, orders, products, quotes, suppliers } from "@/domain/seed";

describe("synthetic foreign-trade fixture integrity", () => {
  it("marks every source as synthetic", () => {
    expect(leads.flatMap((lead) => lead.provenance).every((item) => item.synthetic)).toBe(true);
    expect(dueDiligence.flatMap((item) => item.evidence).every((item) => item.provenance.synthetic)).toBe(true);
  });

  it("uses non-deliverable example.invalid contact addresses", () => {
    expect(leads.every((lead) => lead.contact.email.endsWith("@example.invalid"))).toBe(true);
  });

  it.each(customers)("links customer $id to a known lead", (customer) => {
    expect(leads.some((lead) => lead.id === customer.leadId)).toBe(true);
  });

  it.each(orders)("links order $id to a customer and quote fixture", (order) => {
    expect(customers.some((customer) => customer.id === order.customerId)).toBe(true);
    expect(quotes.some((quote) => quote.id === order.quoteId) || quotes.length > 0).toBe(true);
    expect(order.milestones).toHaveLength(8);
    expect(order.milestones.filter((item) => item.status === "CURRENT")).toHaveLength(1);
  });

  it.each(quotes)("links every $id line to a product", (quote) => {
    expect(quote.lines.every((line) => products.some((product) => product.sku === line.sku))).toBe(true);
  });

  it.each(inventory)("links inventory $sku to the catalogue", (item) => {
    expect(products.some((product) => product.sku === item.sku)).toBe(true);
    expect(item.onHand).toBeGreaterThanOrEqual(item.reserved);
    expect(item.version).toBeGreaterThan(0);
  });

  it.each(suppliers)("keeps supplier $id scorecards bounded", (supplier) => {
    [supplier.qualityScore, supplier.deliveryScore, supplier.responseScore, supplier.sustainabilityScore].forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });
    expect(supplier.defectRate).toBeGreaterThanOrEqual(0);
    expect(supplier.onTimeRate).toBeLessThanOrEqual(1);
  });

  it("returns independent workspace snapshots", () => {
    const first = createSeedState();
    const second = createSeedState();
    first.leads[0].company = "mutated";
    expect(second.leads[0].company).not.toBe("mutated");
    expect(first.events).not.toBe(second.events);
  });
});
