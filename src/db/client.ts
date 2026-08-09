import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { getRuntimeConfig } from "@/server/config";
import * as schema from "./schema";

export type AppDatabase = NeonHttpDatabase<typeof schema>;

let database: AppDatabase | undefined;

export function getDatabase(): AppDatabase {
  if (database) return database;
  const config = getRuntimeConfig();
  if (config.dataMode !== "database" || !config.databaseUrl) {
    throw new Error("A shared database was requested while DATA_MODE is not database");
  }
  database = drizzle(config.databaseUrl, { schema, casing: "snake_case" });
  return database;
}

export function resetDatabaseForTests() {
  database = undefined;
}
