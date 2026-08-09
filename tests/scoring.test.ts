import { describe, expect, it } from "vitest";
import { assessDueDiligence, findSimilarCustomers, riskTier, scoreLead } from "@/domain/scoring";
import { customers, leads } from "@/domain/seed";
import type { Lead } from "@/domain/types";

function withoutGeneratedScore(lead: Lead): Omit<Lead, "score" | "scoreReasons"> {
  const input = { ...lead };
  Reflect.deleteProperty(input, "score");
  Reflect.deleteProperty(input, "scoreReasons");
  return input;
}

describe("lead scoring", () => {
  it.each(leads)("keeps $id inside the 0-100 policy range", (lead) => {
    const result = scoreLead(withoutGeneratedScore(lead));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.scoreReasons.length).toBeGreaterThan(0);
  });

  it("rewards a multi-category, multi-source target", () => {
    const result = scoreLead(withoutGeneratedScore(leads[0]));
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.scoreReasons).toContain("Multi-category portfolio fit");
    expect(result.scoreReasons).toContain("Multi-source corroboration");
  });

  it("penalizes opaque general trading companies", () => {
    const result = scoreLead(withoutGeneratedScore(leads.at(-1)!));
    expect(result.score).toBeLessThan(70);
    expect(result.scoreReasons).toContain("End-market clarity required");
  });
});

describe("due diligence policy", () => {
  it.each([
    [10, "CLEAR", "LOW"],
    [34, "CLEAR", "MEDIUM"],
    [59, "CLEAR", "MEDIUM"],
    [60, "CLEAR", "HIGH"],
    [5, "POTENTIAL_MATCH", "HIGH"],
    [5, "BLOCKED", "BLOCKED"],
  ] as const)("maps score %i and %s to %s", (score, sanctions, expected) => {
    expect(riskTier(score, sanctions)).toBe(expected);
  });

  it("requires review for a potential name match without asserting guilt", () => {
    const result = assessDueDiligence({ leadId: "L-1", registration: "ACTIVE", sanctionsScreen: "POTENTIAL_MATCH", adverseMedia: "NONE", paymentRisk: 12, domainAgeYears: 8, evidenceCount: 3 });
    expect(result.tier).toBe("HIGH");
    expect(result.humanReviewRequired).toBe(true);
    expect(result.flags.join(" ")).toMatch(/Potential sanctions name match/);
  });

  it("elevates weak evidence and registration risk", () => {
    const result = assessDueDiligence({ leadId: "L-2", registration: "UNVERIFIED", sanctionsScreen: "CLEAR", adverseMedia: "REVIEW", paymentRisk: 44, domainAgeYears: 1, evidenceCount: 1 });
    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.flags).toHaveLength(4);
  });

  it("permits a well-evidenced low-risk fixture", () => {
    const result = assessDueDiligence({ leadId: "L-3", registration: "ACTIVE", sanctionsScreen: "CLEAR", adverseMedia: "NONE", paymentRisk: 10, domainAgeYears: 12, evidenceCount: 3 });
    expect(result.tier).toBe("LOW");
    expect(result.humanReviewRequired).toBe(false);
    expect(result.flags).toEqual([]);
  });
});

describe("explainable customer similarity", () => {
  it.each(customers)("returns deterministic ranked results for $id", (customer) => {
    const first = findSimilarCustomers(customer, leads);
    const second = findSimilarCustomers(customer, leads);
    expect(first).toEqual(second);
    expect(first).toHaveLength(leads.filter((lead) => lead.company !== customer.company).length);
    expect(first[0].score).toBeGreaterThanOrEqual(first.at(-1)!.score);
  });

  it("exposes all five score dimensions", () => {
    const [result] = findSimilarCustomers(customers[0], leads);
    expect(Object.keys(result.dimensions).sort()).toEqual(["channel", "geography", "industry", "products", "scale"]);
    expect(result.explanation).toHaveLength(3);
  });

  it("never returns the seed customer itself", () => {
    const result = findSimilarCustomers(customers[0], leads);
    expect(result.some((item) => item.company === customers[0].company)).toBe(false);
  });
});
