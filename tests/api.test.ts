import { describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { POST as discover } from "@/app/api/leads/discover/route";
import { POST as diligence } from "@/app/api/due-diligence/route";
import { POST as similarity } from "@/app/api/similarity/route";
import { POST as quote } from "@/app/api/quote/route";
import { POST as reserve } from "@/app/api/inventory/reserve/route";
import { POST as profit } from "@/app/api/finance/profit/route";
import { POST as audit } from "@/app/api/audit/verify/route";
import { GET as document } from "@/app/api/documents/[type]/route";
import { GET as cron } from "@/app/api/cron/daily/route";
import { createSeedState, quotes } from "@/domain/seed";

const jsonPost = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("public system APIs", () => {
  it("reports deterministic service health", async () => {
    const response = await health();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.documentTypes).toBe(8);
    expect(body.dataMode).toBe("deterministic-synthetic");
  });

  it("discovers synthetic leads without contacting people", async () => {
    const response = await discover(jsonPost("http://test/api/leads/discover", { mode: "synthetic", existingIds: [] }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.realPeopleContacted).toBe(0);
    expect(body.added.length).toBeGreaterThan(0);
  });

  it("rejects non-synthetic acquisition mode", async () => {
    const response = await discover(jsonPost("http://test/api/leads/discover", { mode: "real" }));
    expect(response.status).toBe(400);
  });

  it("returns a low-risk due-diligence result", async () => {
    const response = await diligence(jsonPost("http://test/api/due-diligence", { leadId: "LEAD-T", registration: "ACTIVE", sanctionsScreen: "CLEAR", adverseMedia: "NONE", paymentRisk: 8, domainAgeYears: 12, evidenceCount: 3 }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tier).toBe("LOW");
    expect(body.legalDecision).toBe(false);
  });

  it("rejects malformed due-diligence input", async () => {
    const response = await diligence(jsonPost("http://test/api/due-diligence", { leadId: "x" }));
    expect(response.status).toBe(400);
  });

  it("returns ranked lookalike customers", async () => {
    const response = await similarity(jsonPost("http://test/api/similarity", { customerId: "CUS-2401" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.algorithm).toBe("weighted-jaccard-v1");
    expect(body.results[0].score).toBeGreaterThanOrEqual(body.results.at(-1).score);
  });

  it("returns 404 for an unknown lookalike seed", async () => {
    const response = await similarity(jsonPost("http://test/api/similarity", { customerId: "CUS-MISSING" }));
    expect(response.status).toBe(404);
  });

  it("calculates a quote through the API boundary", async () => {
    const response = await quote(jsonPost("http://test/api/quote", quotes[0]));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.quoteId).toBe(quotes[0].id);
    expect(body.netMargin).toBeGreaterThan(0);
  });

  it("rejects malformed quote lines", async () => {
    const response = await quote(jsonPost("http://test/api/quote", { ...quotes[0], lines: [] }));
    expect(response.status).toBe(400);
  });

  it("accepts an inventory reservation", async () => {
    const response = await reserve(jsonPost("http://test/api/inventory/reserve", { requestId: "API-R1", sku: "MT-DRL-18V", quantity: 10, expectedVersion: 7 }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("RESERVED");
  });

  it("returns 409 for an inventory oversell", async () => {
    const response = await reserve(jsonPost("http://test/api/inventory/reserve", { requestId: "API-R2", sku: "MT-DRL-18V", quantity: 10000 }));
    expect(response.status).toBe(409);
  });

  it("returns 404 for an unknown inventory SKU", async () => {
    const response = await reserve(jsonPost("http://test/api/inventory/reserve", { requestId: "API-R3", sku: "MISSING", quantity: 1 }));
    expect(response.status).toBe(404);
  });

  it("returns baseline and stress-scenario profit", async () => {
    const response = await profit(jsonPost("http://test/api/finance/profit", { orderId: "SO-260731", cnyWeakeningRate: 0.05, freightIncreaseRate: 0.5 }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.baseline.orderId).toBe("SO-260731");
    expect(body.scenario.netProfitUsd).not.toBe(body.baseline.netProfitUsd);
  });

  it("returns 404 for a missing ledger", async () => {
    const response = await profit(jsonPost("http://test/api/finance/profit", { orderId: "SO-MISSING" }));
    expect(response.status).toBe(404);
  });

  it("verifies the audit chain through the API", async () => {
    const state = createSeedState();
    const response = await audit(jsonPost("http://test/api/audit/verify", { events: state.events }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.valid).toBe(true);
  });

  it("rejects malformed audit chains", async () => {
    const response = await audit(jsonPost("http://test/api/audit/verify", { events: [{ id: "x" }] }));
    expect(response.status).toBe(400);
  });

  it("serves a PDF document with safety headers", async () => {
    const response = await document(new Request("http://test/api/documents/quotation?order=SO-260731"), { params: Promise.resolve({ type: "quotation" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("x-synthetic-demo")).toBe("true");
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns 404 for an unknown document", async () => {
    const response = await document(new Request("http://test/api/documents/secret"), { params: Promise.resolve({ type: "secret" }) });
    expect(response.status).toBe(404);
  });

  it("protects cron when no secret is configured", async () => {
    const before = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const response = await cron(new Request("http://test/api/cron/daily"));
    expect(response.status).toBe(401);
    if (before) process.env.CRON_SECRET = before;
  });

  it("executes a protected cron dry-run with the correct secret", async () => {
    const before = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    const response = await cron(new Request("http://test/api/cron/daily", { headers: { authorization: "Bearer test-secret" } }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.dryRun).toBe(true);
    if (before) process.env.CRON_SECRET = before; else delete process.env.CRON_SECRET;
  });
});
