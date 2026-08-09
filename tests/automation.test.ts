import { describe, expect, it } from "vitest";
import { discoveredLeadFixtures, runDailyControlTower, runLeadDiscovery } from "@/domain/automation";
import { createSeedState, leads } from "@/domain/seed";

describe("autonomous control loops", () => {
  it("discovers and scores every net-new fixture", () => {
    const result = runLeadDiscovery(leads);
    expect(result.added).toHaveLength(discoveredLeadFixtures.length);
    expect(result.leads).toHaveLength(leads.length + discoveredLeadFixtures.length);
    expect(result.added.every((lead) => lead.score > 0 && lead.scoreReasons.length > 0)).toBe(true);
    expect(result.run.savedMinutes).toBeGreaterThan(0);
  });

  it("does not create duplicate entities on replay", () => {
    const first = runLeadDiscovery(leads);
    const second = runLeadDiscovery(first.leads);
    expect(second.added).toEqual([]);
    expect(second.leads).toHaveLength(first.leads.length);
    expect(second.run.steps[1].detail).toContain("2 duplicate");
  });

  it("keeps real outreach at zero by construction", () => {
    const result = runLeadDiscovery(leads);
    expect(result.run.steps.at(-1)!.detail).toMatch(/No real outreach/);
    expect(result.added.every((lead) => lead.contact.email.endsWith(".invalid"))).toBe(true);
  });

  it("runs a deterministic daily control-tower dry-run", () => {
    const state = createSeedState();
    const first = runDailyControlTower(state);
    const second = runDailyControlTower(state);
    expect(first).toEqual(second);
    expect(first.dryRun).toBe(true);
    expect(first.actions).toHaveLength(4);
    expect(first.evaluated.leads).toBe(state.leads.length);
  });
});
