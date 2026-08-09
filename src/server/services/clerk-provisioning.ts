import type { WebhookEvent } from "@clerk/backend/webhooks";
import { and, eq, or } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { inboxEvents, memberships, organizations, users, type Organization } from "@/db/schema";
import type { ApplicationRole } from "@/server/auth/context";
import { sha256 } from "@/server/crypto";

const internalId = (prefix: string, externalId: string) => `${prefix}_${sha256(externalId).slice(0, 24)}`;
const jsonObject = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

export function mapClerkOrganizationRole(role: string): ApplicationRole {
  const normalized = role.toLowerCase();
  if (normalized === "org:owner" || normalized.endsWith(":owner")) return "OWNER";
  if (normalized === "org:admin" || normalized.endsWith(":admin")) return "ADMIN";
  if (normalized === "org:ops" || normalized.endsWith(":ops")) return "OPS";
  if (normalized === "org:sales" || normalized.endsWith(":sales")) return "SALES";
  if (normalized === "org:finance" || normalized.endsWith(":finance")) return "FINANCE";
  return "VIEWER";
}

async function upsertOrganization(database: AppDatabase, data: { id: string; slug: string; name: string }): Promise<Organization> {
  const existing = await database.query.organizations.findFirst({
    where: or(eq(organizations.externalIdentityId, data.id), eq(organizations.slug, data.slug)),
  });
  if (existing) {
    const [updated] = await database.update(organizations).set({
      externalIdentityId: data.id,
      slug: data.slug,
      name: data.name,
      operatingMode: "CONTROLLED",
      updatedAt: new Date().toISOString(),
    }).where(eq(organizations.id, existing.id)).returning();
    return updated;
  }
  const [created] = await database.insert(organizations).values({
    id: internalId("org", data.id),
    externalIdentityId: data.id,
    slug: data.slug,
    name: data.name,
    operatingMode: "CONTROLLED",
  }).returning();
  return created;
}

async function upsertUser(database: AppDatabase, data: { id: string; email: string; displayName: string }) {
  const existing = await database.query.users.findFirst({
    where: or(eq(users.externalIdentityId, data.id), eq(users.email, data.email)),
  });
  if (existing) {
    const [updated] = await database.update(users).set({
      externalIdentityId: data.id,
      email: data.email,
      displayName: data.displayName,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, existing.id)).returning();
    return updated;
  }
  const [created] = await database.insert(users).values({
    id: internalId("user", data.id),
    externalIdentityId: data.id,
    email: data.email,
    displayName: data.displayName,
  }).returning();
  return created;
}

function userIdentity(data: Extract<WebhookEvent, { type: "user.created" | "user.updated" }>["data"]) {
  const primary = data.email_addresses.find((email) => email.id === data.primary_email_address_id) ?? data.email_addresses[0];
  return {
    id: data.id,
    email: primary?.email_address ?? `${data.id}@identity.invalid`,
    displayName: [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || "MERIDIAN User",
  };
}

export async function processClerkWebhook(database: AppDatabase, eventId: string, event: WebhookEvent) {
  const existing = await database.query.inboxEvents.findFirst({
    where: and(eq(inboxEvents.provider, "clerk"), eq(inboxEvents.externalEventId, eventId)),
  });
  if (existing?.status === "PROCESSED") return { status: "IDEMPOTENT_REPLAY", eventId, organizationId: existing.organizationId } as const;

  if (!existing) {
    await database.insert(inboxEvents).values({
      id: internalId("inbox", eventId),
      provider: "clerk",
      externalEventId: eventId,
      eventType: event.type,
      payload: jsonObject(event.data),
      status: "RECEIVED",
    }).onConflictDoNothing();
  }

  let organizationId: string | null = null;
  try {
    if (event.type === "organization.created" || event.type === "organization.updated") {
      const organization = await upsertOrganization(database, event.data);
      organizationId = organization.id;
    } else if (event.type === "organization.deleted") {
      const externalId = event.data.id;
      const organization = externalId
        ? await database.query.organizations.findFirst({ where: eq(organizations.externalIdentityId, externalId) })
        : undefined;
      if (organization) {
        organizationId = organization.id;
        await database.update(organizations).set({ operatingMode: "SUSPENDED", updatedAt: new Date().toISOString() }).where(eq(organizations.id, organization.id));
      }
    } else if (event.type === "user.created" || event.type === "user.updated") {
      await upsertUser(database, userIdentity(event.data));
    } else if (event.type === "user.deleted") {
      const externalId = event.data.id;
      const user = externalId
        ? await database.query.users.findFirst({ where: eq(users.externalIdentityId, externalId) })
        : undefined;
      if (user) {
        await database.update(users).set({
          externalIdentityId: null,
          email: `deleted+${sha256(externalId!).slice(0, 20)}@identity.invalid`,
          displayName: "Deleted User",
          updatedAt: new Date().toISOString(),
        }).where(eq(users.id, user.id));
      }
    } else if (
      event.type === "organizationMembership.created"
      || event.type === "organizationMembership.updated"
      || event.type === "organizationMembership.deleted"
    ) {
      const organization = await upsertOrganization(database, event.data.organization);
      organizationId = organization.id;
      const user = await upsertUser(database, {
        id: event.data.public_user_data.user_id,
        email: event.data.public_user_data.identifier,
        displayName: [event.data.public_user_data.first_name, event.data.public_user_data.last_name].filter(Boolean).join(" ") || event.data.public_user_data.identifier,
      });
      if (event.type === "organizationMembership.deleted") {
        await database.delete(memberships).where(and(eq(memberships.organizationId, organization.id), eq(memberships.userId, user.id)));
      } else {
        await database.insert(memberships).values({
          organizationId: organization.id,
          userId: user.id,
          role: mapClerkOrganizationRole(event.data.role),
        }).onConflictDoUpdate({
          target: [memberships.organizationId, memberships.userId],
          set: { role: mapClerkOrganizationRole(event.data.role), updatedAt: new Date().toISOString() },
        });
      }
    }

    await database.update(inboxEvents).set({
      organizationId,
      status: "PROCESSED",
      processedAt: new Date().toISOString(),
      error: null,
    }).where(and(eq(inboxEvents.provider, "clerk"), eq(inboxEvents.externalEventId, eventId)));
    return { status: "PROCESSED", eventId, organizationId } as const;
  } catch (error) {
    await database.update(inboxEvents).set({
      organizationId,
      status: "FAILED",
      error: { message: error instanceof Error ? error.message : "Provisioning failed" },
    }).where(and(eq(inboxEvents.provider, "clerk"), eq(inboxEvents.externalEventId, eventId)));
    throw error;
  }
}
