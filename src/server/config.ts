import { z } from "zod";
import { AppError } from "./errors";

const environmentSchema = z.object({
  DATA_MODE: z.enum(["fixture", "database"]).default("fixture"),
  AUTH_MODE: z.enum(["demo", "clerk"]).optional(),
  OUTBOUND_MODE: z.literal("draft").default("draft"),
  DATABASE_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  PORTAL_TOKEN_SECRET: z.string().min(32).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
});

export interface RuntimeConfig {
  dataMode: "fixture" | "database";
  authMode: "demo" | "clerk";
  outboundMode: "draft";
  databaseUrl?: string;
  portalTokenSecret?: string;
  blobConfigured: boolean;
  cronConfigured: boolean;
}

export function getRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new AppError("CONFIGURATION_ERROR", "Runtime configuration is invalid", {
      fields: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
  }

  const authMode = parsed.data.AUTH_MODE ?? (parsed.data.DATA_MODE === "database" ? "clerk" : "demo");
  if (parsed.data.DATA_MODE === "database" && !parsed.data.DATABASE_URL) {
    throw new AppError("CONFIGURATION_ERROR", "DATABASE_URL is required when DATA_MODE=database");
  }
  if (parsed.data.DATA_MODE === "database" && authMode !== "clerk") {
    throw new AppError("CONFIGURATION_ERROR", "Database mode requires organization-scoped Clerk authentication");
  }
  if (authMode === "clerk" && (!parsed.data.CLERK_SECRET_KEY || !parsed.data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)) {
    throw new AppError("CONFIGURATION_ERROR", "Clerk publishable and secret keys are required when AUTH_MODE=clerk");
  }

  return {
    dataMode: parsed.data.DATA_MODE,
    authMode,
    outboundMode: parsed.data.OUTBOUND_MODE,
    databaseUrl: parsed.data.DATABASE_URL,
    portalTokenSecret: parsed.data.PORTAL_TOKEN_SECRET,
    blobConfigured: Boolean(parsed.data.BLOB_READ_WRITE_TOKEN),
    cronConfigured: Boolean(parsed.data.CRON_SECRET),
  };
}

export function getCapabilitySnapshot(environment: NodeJS.ProcessEnv = process.env) {
  try {
    const config = getRuntimeConfig(environment);
    return {
      ready: true,
      data: config.dataMode,
      auth: config.authMode,
      outbound: config.outboundMode,
      customerPortal: config.portalTokenSecret ? "signed-token-ready" : "issuance-disabled",
      documentStorage: config.blobConfigured ? "vercel-blob" : "ephemeral",
      cron: config.cronConfigured ? "protected" : "disabled",
    } as const;
  } catch (error) {
    return {
      ready: false,
      data: environment.DATA_MODE ?? "fixture",
      auth: environment.AUTH_MODE ?? "automatic",
      outbound: "draft",
      customerPortal: environment.PORTAL_TOKEN_SECRET ? "signed-token-ready" : "issuance-disabled",
      documentStorage: environment.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "ephemeral",
      cron: environment.CRON_SECRET ? "protected" : "disabled",
      error: error instanceof Error ? error.message : "Invalid runtime configuration",
    } as const;
  }
}
