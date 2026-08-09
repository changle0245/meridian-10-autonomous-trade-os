import type { AuditEvent } from "./types";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}

export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function appendEvent(
  events: AuditEvent[],
  input: Omit<AuditEvent, "previousHash" | "hash">,
): AuditEvent[] {
  const previousHash = events.at(-1)?.hash ?? "GENESIS";
  const eventWithoutHash = { ...input, previousHash };
  const hash = hashText(stableStringify(eventWithoutHash));
  return [...events, { ...eventWithoutHash, hash }];
}

export function verifyEventChain(events: AuditEvent[]): { valid: boolean; checked: number; brokenAt?: string; expected?: string; actual?: string } {
  let previousHash = "GENESIS";
  for (const event of events) {
    if (event.previousHash !== previousHash) return { valid: false, checked: events.indexOf(event), brokenAt: event.id, expected: previousHash, actual: event.previousHash };
    const { hash, ...eventWithoutHash } = event;
    const expected = hashText(stableStringify(eventWithoutHash));
    if (hash !== expected) return { valid: false, checked: events.indexOf(event), brokenAt: event.id, expected, actual: hash };
    previousHash = hash;
  }
  return { valid: true, checked: events.length };
}

export function createInitialEvents(tenantId: string): AuditEvent[] {
  let events: AuditEvent[] = [];
  events = appendEvent(events, { id: "EVT-0001", tenantId, at: "2026-08-09T01:15:00.000Z", actor: "Lead Radar Agent", action: "LEADS_SCORED", entity: "lead-batch", entityId: "BATCH-0809", payload: { discovered: 8, qualified: 3, synthetic: true } });
  events = appendEvent(events, { id: "EVT-0002", tenantId, at: "2026-08-09T02:05:00.000Z", actor: "Risk Agent", action: "RESEARCH_HELD", entity: "lead", entityId: "LEAD-1052", payload: { reason: "potential-name-match", realActionTaken: false } });
  events = appendEvent(events, { id: "EVT-0003", tenantId, at: "2026-08-09T04:42:00.000Z", actor: "Quote Agent", action: "MARGIN_GUARD_PASSED", entity: "quote", entityId: "QT-2026-0819", payload: { minMargin: 0.08, approvedByPolicy: true } });
  events = appendEvent(events, { id: "EVT-0004", tenantId, at: "2026-08-09T06:10:00.000Z", actor: "Fulfillment Agent", action: "MILESTONE_DRAFTED", entity: "order", entityId: "SO-260731", payload: { milestone: "Vessel booking", delivery: "outbox-draft" } });
  events = appendEvent(events, { id: "EVT-0005", tenantId, at: "2026-08-09T08:25:00.000Z", actor: "Inventory Agent", action: "STOCK_RECONCILED", entity: "inventory", entityId: "MT-DRL-18V", payload: { version: 7, variance: 0 } });
  return events;
}
