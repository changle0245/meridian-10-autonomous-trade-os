import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import * as schema from "../src/db/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to run database migrations");

const database = drizzle(databaseUrl, { schema, casing: "snake_case" });

try {
  await migrate(database, { migrationsFolder: "drizzle" });
  console.info("MERIDIAN database migrations completed successfully.");
} finally {
  await database.$client.end();
}
