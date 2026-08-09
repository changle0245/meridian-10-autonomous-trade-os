ALTER TABLE "inbox_events" DROP CONSTRAINT "inbox_events_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "inbox_events_org_provider_external_unique";--> statement-breakpoint
ALTER TABLE "inbox_events" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inbox_events" ADD CONSTRAINT "inbox_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_events_provider_external_unique" ON "inbox_events" USING btree ("provider","external_event_id");