import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { memberships, organizations, users } from "@/db/schema";
import { TENANT_ID } from "@/domain/seed";
import { getRuntimeConfig } from "@/server/config";
import { AppError } from "@/server/errors";

export type ApplicationRole = "OWNER" | "ADMIN" | "OPS" | "SALES" | "FINANCE" | "VIEWER";

export interface RequestContext {
  organizationId: string;
  userId: string;
  role: ApplicationRole;
  actorType: "USER" | "SYSTEM";
  mode: "fixture" | "database";
}

export const demoRequestContext: RequestContext = {
  organizationId: TENANT_ID,
  userId: "user-meridian-demo",
  role: "OWNER",
  actorType: "USER",
  mode: "fixture",
};

export async function getRequestContext(): Promise<RequestContext> {
  const config = getRuntimeConfig();
  if (config.dataMode === "fixture") return demoRequestContext;

  const { auth } = await import("@clerk/nextjs/server");
  const session = await auth();
  if (!session.userId) throw new AppError("UNAUTHENTICATED", "Sign in is required");
  if (!session.orgId) throw new AppError("FORBIDDEN", "Select an organization before accessing trade data");

  const database = getDatabase();
  const rows = await database
    .select({ organizationId: organizations.id, userId: users.id, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(organizations.externalIdentityId, session.orgId), eq(users.externalIdentityId, session.userId)))
    .limit(1);

  const membership = rows[0];
  if (!membership) {
    throw new AppError("FORBIDDEN", "The signed-in identity has no provisioned MERIDIAN organization membership");
  }

  return {
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
    actorType: "USER",
    mode: "database",
  };
}

const roleRank: Record<ApplicationRole, number> = {
  VIEWER: 0,
  SALES: 1,
  FINANCE: 1,
  OPS: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function requireRole(context: RequestContext, minimum: ApplicationRole) {
  if (roleRank[context.role] < roleRank[minimum]) {
    throw new AppError("FORBIDDEN", `${minimum} permission is required`);
  }
}

export function requireAnyRole(context: RequestContext, allowed: readonly ApplicationRole[]) {
  if (!allowed.includes(context.role)) {
    throw new AppError("FORBIDDEN", `One of these roles is required: ${allowed.join(", ")}`);
  }
}
