import { describe, expect, it } from "vitest";
import { appendEvent, createInitialEvents, hashText, verifyEventChain } from "@/domain/audit";
import { TENANT_ID } from "@/domain/seed";

describe("tamper-evident audit ledger", () => {
  it("builds a valid genesis-linked fixture chain", () => {
    const events = createInitialEvents(TENANT_ID);
    expect(events[0].previousHash).toBe("GENESIS");
    expect(verifyEventChain(events)).toEqual({ valid: true, checked: events.length });
  });

  it("produces deterministic hashes", () => {
    expect(hashText("meridian")).toBe(hashText("meridian"));
    expect(hashText("meridian")).not.toBe(hashText("Meridian"));
    expect(hashText("meridian")).toMatch(/^fnv1a-[0-9a-f]{8}$/);
  });

  it("appends without mutating the previous array", () => {
    const before = createInitialEvents(TENANT_ID);
    const next = appendEvent(before, { id: "EVT-NEXT", tenantId: TENANT_ID, at: "2026-08-09T12:00:00.000Z", actor: "Test", action: "TESTED", entity: "suite", entityId: "1", payload: { ok: true } });
    expect(next).toHaveLength(before.length + 1);
    expect(before).toHaveLength(5);
    expect(next.at(-1)!.previousHash).toBe(before.at(-1)!.hash);
    expect(verifyEventChain(next).valid).toBe(true);
  });

  it.each([0, 1, 2, 3, 4])("detects payload tampering at event index %i", (index) => {
    const events = structuredClone(createInitialEvents(TENANT_ID));
    events[index].payload = { injected: true };
    const result = verifyEventChain(events);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(events[index].id);
  });

  it("detects a broken previous-hash pointer", () => {
    const events = structuredClone(createInitialEvents(TENANT_ID));
    events[3].previousHash = "forged";
    const result = verifyEventChain(events);
    expect(result.valid).toBe(false);
    expect(result.expected).toBe(events[2].hash);
  });

  it("accepts an empty chain", () => {
    expect(verifyEventChain([])).toEqual({ valid: true, checked: 0 });
  });
});
