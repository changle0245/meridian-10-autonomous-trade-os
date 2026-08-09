import { scoreLead } from "./scoring";
import type { AutomationRun, Lead, WorkspaceState } from "./types";

export const discoveredLeadFixtures: Omit<Lead, "score" | "scoreReasons">[] = [
  {
    id: "LEAD-1056", tenantId: "tenant-meridian-demo", company: "Alpine Workshop Systems AG", country: "Switzerland", region: "EU", industry: "Industrial Distribution", employees: 88, revenueBand: "USD 25M-50M", channels: ["dealer network", "e-commerce"], productsWanted: ["Power Tools", "Measuring Tools"], certifications: ["ISO 9001"], contact: { name: "Lea Hartmann", title: "Strategic Buyer", email: "lea.hartmann@example.invalid" }, stage: "NEW", provenance: [{ sourceId: "SRC-AUTO-91", label: "Synthetic trade signal", kind: "synthetic-fixture", observedAt: "2026-08-09T09:00:00.000Z", synthetic: true }], lastSignalAt: "2026-08-09T09:00:00.000Z",
  },
  {
    id: "LEAD-1057", tenantId: "tenant-meridian-demo", company: "Andes ProSupply Peru SAC", country: "Peru", region: "LATAM", industry: "Construction Supply", employees: 57, revenueBand: "USD 10M-25M", channels: ["projects", "dealer network"], productsWanted: ["Safety", "Hand Tools"], certifications: ["ISO 45001"], contact: { name: "Ana Velasquez", title: "Import Buyer", email: "ana.velasquez@example.invalid" }, stage: "NEW", provenance: [{ sourceId: "SRC-AUTO-92", label: "Synthetic exhibition signal", kind: "exhibition", observedAt: "2026-08-09T09:00:00.000Z", synthetic: true }], lastSignalAt: "2026-08-09T09:00:00.000Z",
  },
];

export function runLeadDiscovery(existing: Lead[]): { leads: Lead[]; run: AutomationRun; added: Lead[] } {
  const existingIds = new Set(existing.map((lead) => lead.id));
  const added = discoveredLeadFixtures
    .filter((fixture) => !existingIds.has(fixture.id))
    .map((fixture) => ({ ...fixture, ...scoreLead(fixture) }));
  const run: AutomationRun = {
    id: `RUN-DISC-${existing.length + added.length}`,
    name: "On-demand lead discovery",
    status: "SUCCEEDED",
    trigger: "MANUAL",
    startedAt: "2026-08-09T10:00:00.000Z",
    finishedAt: "2026-08-09T10:00:09.000Z",
    savedMinutes: 31,
    steps: [
      { label: "Read synthetic source fixtures", status: "DONE", detail: "12 signals normalized" },
      { label: "Entity resolution", status: "DONE", detail: `${discoveredLeadFixtures.length - added.length} duplicate fixtures ignored` },
      { label: "ICP scoring", status: "DONE", detail: `${added.length} net-new leads scored` },
      { label: "Policy boundary", status: "DONE", detail: "No real outreach or personal-data lookup performed" },
    ],
  };
  return { leads: [...added, ...existing], run, added };
}

export function runDailyControlTower(state: WorkspaceState): { evaluated: Record<string, number>; actions: string[]; dryRun: true } {
  const staleEvidence = state.dueDiligence.flatMap((item) => item.evidence).filter((item) => item.expiresInDays <= 7).length;
  const dueFollowUps = state.customers.filter((customer) => customer.nextActionAt <= "2026-08-13T23:59:59.000Z").length;
  const milestoneChanges = state.orders.flatMap((order) => order.milestones).filter((milestone) => milestone.status === "CURRENT").length;
  const lowStock = state.inventory.filter((item) => item.onHand - item.reserved < item.safetyStock).length;
  return {
    evaluated: { leads: state.leads.length, staleEvidence, dueFollowUps, milestoneChanges, lowStock },
    actions: [
      `${staleEvidence} evidence refresh task(s) drafted`,
      `${dueFollowUps} follow-up reminder(s) drafted`,
      `${milestoneChanges} customer milestone update(s) drafted`,
      `${lowStock} replenishment review(s) drafted`,
    ],
    dryRun: true,
  };
}
