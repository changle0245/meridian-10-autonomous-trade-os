"use client";

import { openDB, type DBSchema } from "idb";
import type { WorkspaceState } from "@/domain/types";

interface MeridianDb extends DBSchema {
  workspace: {
    key: string;
    value: WorkspaceState;
  };
}

const DATABASE = "meridian-10-demo";
const KEY = "active-workspace";

async function db() {
  return openDB<MeridianDb>(DATABASE, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("workspace")) database.createObjectStore("workspace");
    },
  });
}

export async function loadWorkspace(fallback: WorkspaceState): Promise<WorkspaceState> {
  try {
    const saved = await (await db()).get("workspace", KEY);
    if (!saved || saved.schemaVersion !== fallback.schemaVersion || saved.tenantId !== fallback.tenantId) return fallback;
    return saved;
  } catch {
    return fallback;
  }
}

export async function saveWorkspace(state: WorkspaceState): Promise<void> {
  try {
    await (await db()).put("workspace", state, KEY);
  } catch {
    // The app remains usable in memory when private browsing blocks IndexedDB.
  }
}

export async function clearWorkspace(): Promise<void> {
  try {
    await (await db()).delete("workspace", KEY);
  } catch {
    // No-op: a blocked browser store is already effectively reset.
  }
}

export function exportWorkspace(state: WorkspaceState): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), product: "MERIDIAN 10", state }, null, 2);
}

export function parseWorkspace(value: string, expectedTenant: string): WorkspaceState {
  const parsed = JSON.parse(value) as { state?: WorkspaceState } | WorkspaceState;
  const state = "state" in parsed && parsed.state ? parsed.state : (parsed as WorkspaceState);
  if (state.schemaVersion !== 3) throw new Error("Unsupported workspace schema");
  if (state.tenantId !== expectedTenant) throw new Error("Cross-tenant import rejected");
  return state;
}
