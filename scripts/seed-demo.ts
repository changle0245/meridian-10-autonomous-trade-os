import { getDatabase } from "../src/db/client";
import { seedDemoDatabase } from "../src/db/seed";

if (process.env.DATA_MODE !== "database") {
  throw new Error("Set DATA_MODE=database before seeding the shared database");
}

const result = await seedDemoDatabase(getDatabase(), {
  clerkOrganizationId: process.env.SEED_CLERK_ORGANIZATION_ID,
  clerkUserId: process.env.SEED_CLERK_USER_ID,
  portalToken: process.env.SEED_PORTAL_TOKEN,
});

console.info("MERIDIAN deterministic seed completed.", result);
