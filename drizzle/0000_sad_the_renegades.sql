CREATE TYPE "public"."company_kind" AS ENUM('PROSPECT', 'CUSTOMER', 'SUPPLIER', 'PARTNER');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('DRAFT', 'REVIEW', 'APPROVED', 'ISSUED', 'SUPERSEDED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('NEW', 'QUALIFIED', 'RESEARCHED', 'CONTACT_READY', 'CUSTOMER', 'DISQUALIFIED');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('OWNER', 'ADMIN', 'OPS', 'SALES', 'FINANCE', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'HELD');--> statement-breakpoint
CREATE TYPE "public"."order_stage" AS ENUM('SIGNED', 'PROCUREMENT', 'PRODUCTION', 'QUALITY_CHECK', 'BOOKED', 'CUSTOMS', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('DRAFT', 'REVIEW', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('RESERVED', 'RELEASED', 'CONSUMED');--> statement-breakpoint
CREATE TYPE "public"."risk_tier" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" "company_kind" NOT NULL,
	"legal_name" text NOT NULL,
	"trading_name" text,
	"country_code" text NOT NULL,
	"region" text,
	"industry" text,
	"website" text,
	"registration_number" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sales_order_id" text NOT NULL,
	"kind" text NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"amount_usd" numeric(18, 2) NOT NULL,
	"exchange_rate" numeric(12, 6) DEFAULT 1 NOT NULL,
	"source" text NOT NULL,
	"incurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"company_id" text NOT NULL,
	"lead_id" text,
	"owner_user_id" text,
	"segment" text DEFAULT 'STANDARD' NOT NULL,
	"preferred_currency" text DEFAULT 'USD' NOT NULL,
	"preferred_incoterm" text DEFAULT 'FOB' NOT NULL,
	"credit_limit_usd" numeric(18, 2) DEFAULT 0 NOT NULL,
	"payment_terms" text DEFAULT 'PREPAYMENT' NOT NULL,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sales_order_id" text,
	"document_type" text NOT NULL,
	"document_number" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "document_status" DEFAULT 'DRAFT' NOT NULL,
	"content_hash" text NOT NULL,
	"blob_url" text,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"issued_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "due_diligence_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"company_id" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"tier" "risk_tier" DEFAULT 'MEDIUM' NOT NULL,
	"risk_score" integer DEFAULT 50 NOT NULL,
	"registration" text DEFAULT 'UNVERIFIED' NOT NULL,
	"sanctions_screen" text DEFAULT 'UNVERIFIED' NOT NULL,
	"adverse_media" text DEFAULT 'UNVERIFIED' NOT NULL,
	"human_review_required" boolean DEFAULT true NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewed_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" jsonb
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"warehouse_code" text NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"in_production" integer DEFAULT 0 NOT NULL,
	"inbound" integer DEFAULT 0 NOT NULL,
	"safety_stock" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sales_order_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"due_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"company_id" text NOT NULL,
	"source_key" text,
	"stage" "lead_stage" DEFAULT 'NEW' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"products_wanted" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_signal_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "membership_role" DEFAULT 'VIEWER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"default_currency" text DEFAULT 'USD' NOT NULL,
	"operating_mode" text DEFAULT 'CONTROLLED' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"topic" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"deduplication_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "message_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"provider_reference" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"sales_order_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"hs_code" text,
	"unit" text DEFAULT 'pc' NOT NULL,
	"base_cost_cny" numeric(18, 2) DEFAULT 0 NOT NULL,
	"list_price_usd" numeric(18, 2) DEFAULT 0 NOT NULL,
	"weight_kg" numeric(12, 3) DEFAULT 0 NOT NULL,
	"carton_quantity" integer DEFAULT 1 NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purchase_order_number" text NOT NULL,
	"supplier_id" text NOT NULL,
	"sales_order_id" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"expected_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"quote_version_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"unit_cost_cny" numeric(18, 2) NOT NULL,
	"weight_kg" numeric(12, 3) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"version" integer NOT NULL,
	"currency" text NOT NULL,
	"incoterm" text NOT NULL,
	"exchange_rates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pricing_input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pricing_result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"guardrail" text DEFAULT 'REVIEW' NOT NULL,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"quote_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"status" "quote_status" DEFAULT 'DRAFT' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"valid_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"quote_version_id" text,
	"customer_po_number" text,
	"stage" "order_stage" DEFAULT 'SIGNED' NOT NULL,
	"currency" text NOT NULL,
	"incoterm" text NOT NULL,
	"amount_usd" numeric(18, 2) NOT NULL,
	"destination" text NOT NULL,
	"estimated_departure" date,
	"estimated_arrival" date,
	"container" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'UPCOMING' NOT NULL,
	"planned_at" timestamp with time zone,
	"actual_at" timestamp with time zone,
	"owner" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"customer_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sales_order_id" text NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"carrier" text,
	"booking_number" text,
	"container_number" text,
	"estimated_departure" timestamp with time zone,
	"estimated_arrival" timestamp with time zone,
	"actual_departure" timestamp with time zone,
	"actual_arrival" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"inventory_balance_id" text NOT NULL,
	"reservation_id" text,
	"kind" text NOT NULL,
	"quantity_delta" integer NOT NULL,
	"balance_version" integer NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"request_key" text NOT NULL,
	"inventory_balance_id" text NOT NULL,
	"order_id" text,
	"quantity" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'RESERVED' NOT NULL,
	"available_before" integer NOT NULL,
	"available_after" integer NOT NULL,
	"balance_version" integer NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_products" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"product_id" text NOT NULL,
	"supplier_sku" text,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"unit_cost" numeric(18, 2) NOT NULL,
	"minimum_order_quantity" integer DEFAULT 1 NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"available_quantity" integer DEFAULT 0 NOT NULL,
	"source_version" integer DEFAULT 1 NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"company_id" text NOT NULL,
	"quality_score" integer DEFAULT 0 NOT NULL,
	"delivery_score" integer DEFAULT 0 NOT NULL,
	"response_score" integer DEFAULT 0 NOT NULL,
	"sustainability_score" integer DEFAULT 0 NOT NULL,
	"defect_rate" numeric(12, 6) DEFAULT 0 NOT NULL,
	"on_time_rate" numeric(12, 6) DEFAULT 0 NOT NULL,
	"risk" "risk_tier" DEFAULT 'MEDIUM' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"external_identity_id" text,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"external_run_id" text,
	"workflow_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"status" "workflow_status" DEFAULT 'QUEUED' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_diligence_cases" ADD CONSTRAINT "due_diligence_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_diligence_cases" ADD CONSTRAINT "due_diligence_cases_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_diligence_cases" ADD CONSTRAINT "due_diligence_cases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_events" ADD CONSTRAINT "inbox_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD CONSTRAINT "portal_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD CONSTRAINT "portal_grants_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_grants" ADD CONSTRAINT "portal_grants_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_milestones" ADD CONSTRAINT "shipment_milestones_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_milestones" ADD CONSTRAINT "shipment_milestones_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_balance_id_inventory_balances_id_fk" FOREIGN KEY ("inventory_balance_id") REFERENCES "public"."inventory_balances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reservation_id_stock_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."stock_reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_inventory_balance_id_inventory_balances_id_fk" FOREIGN KEY ("inventory_balance_id") REFERENCES "public"."inventory_balances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_org_sequence_unique" ON "audit_events" USING btree ("organization_id","sequence");--> statement-breakpoint
CREATE INDEX "audit_events_org_entity_idx" ON "audit_events" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "companies_org_kind_idx" ON "companies" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_org_legal_country_unique" ON "companies" USING btree ("organization_id","legal_name","country_code");--> statement-breakpoint
CREATE INDEX "cost_entries_org_order_idx" ON "cost_entries" USING btree ("organization_id","sales_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_company_unique" ON "customers" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE INDEX "customers_org_segment_idx" ON "customers" USING btree ("organization_id","segment");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_org_number_version_unique" ON "document_versions" USING btree ("organization_id","document_number","version");--> statement-breakpoint
CREATE INDEX "dd_org_tier_status_idx" ON "due_diligence_cases" USING btree ("organization_id","tier","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_org_scope_key_unique" ON "idempotency_records" USING btree ("organization_id","scope","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_events_org_provider_external_unique" ON "inbox_events" USING btree ("organization_id","provider","external_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_org_product_warehouse_unique" ON "inventory_balances" USING btree ("organization_id","product_id","warehouse_code");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_number_unique" ON "invoices" USING btree ("organization_id","invoice_number");--> statement-breakpoint
CREATE INDEX "leads_org_stage_score_idx" ON "leads" USING btree ("organization_id","stage","score");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_org_company_unique" ON "leads" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_org_source_unique" ON "leads" USING btree ("organization_id","source_key");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_messages_org_dedupe_unique" ON "outbox_messages" USING btree ("organization_id","deduplication_key");--> statement-breakpoint
CREATE INDEX "outbox_messages_status_available_idx" ON "outbox_messages" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_org_provider_reference_unique" ON "payments" USING btree ("organization_id","provider_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_grants_token_hash_unique" ON "portal_grants" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "portal_grants_org_order_idx" ON "portal_grants" USING btree ("organization_id","sales_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_org_sku_unique" ON "products" USING btree ("organization_id","sku");--> statement-breakpoint
CREATE INDEX "purchase_order_lines_po_idx" ON "purchase_order_lines" USING btree ("organization_id","purchase_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_org_number_unique" ON "purchase_orders" USING btree ("organization_id","purchase_order_number");--> statement-breakpoint
CREATE INDEX "quote_lines_quote_idx" ON "quote_lines" USING btree ("organization_id","quote_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_versions_org_quote_version_unique" ON "quote_versions" USING btree ("organization_id","quote_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_org_number_unique" ON "quotes" USING btree ("organization_id","quote_number");--> statement-breakpoint
CREATE INDEX "sales_order_lines_order_idx" ON "sales_order_lines" USING btree ("organization_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_org_number_unique" ON "sales_orders" USING btree ("organization_id","order_number");--> statement-breakpoint
CREATE INDEX "sales_orders_org_stage_idx" ON "sales_orders" USING btree ("organization_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_milestones_org_sequence_unique" ON "shipment_milestones" USING btree ("organization_id","shipment_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_org_reference_unique" ON "shipments" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "stock_movements_org_inventory_idx" ON "stock_movements" USING btree ("organization_id","inventory_balance_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_reservations_org_request_unique" ON "stock_reservations" USING btree ("organization_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_products_org_pair_unique" ON "supplier_products" USING btree ("organization_id","supplier_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_org_company_unique" ON "suppliers" USING btree ("organization_id","company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_identity_unique" ON "users" USING btree ("external_identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_external_unique" ON "workflow_runs" USING btree ("external_run_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_org_entity_idx" ON "workflow_runs" USING btree ("organization_id","entity_type","entity_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION meridian_reserve_inventory(
	p_organization_id text,
	p_actor_id text,
	p_request_key text,
	p_sku text,
	p_quantity integer,
	p_expected_version integer DEFAULT NULL,
	p_order_id text DEFAULT NULL,
	p_warehouse_code text DEFAULT NULL
)
RETURNS TABLE (
	reservation_id text,
	status text,
	request_id text,
	available_before integer,
	available_after integer,
	balance_version integer,
	reason text
)
LANGUAGE plpgsql
AS $$
DECLARE
	v_balance inventory_balances%ROWTYPE;
	v_existing_hash text;
	v_request_hash text;
	v_response jsonb;
	v_http_status integer;
	v_previous_hash text;
	v_audit_payload jsonb;
	v_audit_hash text;
	v_reservation_id text;
BEGIN
	IF p_quantity IS NULL OR p_quantity <= 0 THEN
		RAISE EXCEPTION 'Quantity must be a positive integer' USING ERRCODE = '22023';
	END IF;

	-- The organization row is the serialization boundary for idempotency and the audit hash chain.
	PERFORM 1 FROM organizations AS organization
	WHERE organization.id = p_organization_id
	FOR UPDATE;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Unknown organization' USING ERRCODE = '22023';
	END IF;

	v_request_hash := encode(
		sha256(convert_to(
			concat_ws('|', p_organization_id, p_request_key, p_sku, p_quantity::text, coalesce(p_expected_version::text, ''), coalesce(p_order_id, ''), coalesce(p_warehouse_code, '')),
			'UTF8'
		)),
		'hex'
	);

	SELECT record.request_hash, record.response
	INTO v_existing_hash, v_response
	FROM idempotency_records AS record
	WHERE record.organization_id = p_organization_id
		AND record.scope = 'inventory.reserve'
		AND record.idempotency_key = p_request_key;

	IF FOUND THEN
		request_id := p_request_key;
		IF v_existing_hash <> v_request_hash THEN
			reservation_id := NULL;
			status := 'IDEMPOTENCY_CONFLICT';
			available_before := NULL;
			available_after := NULL;
			balance_version := NULL;
			reason := 'The idempotency key was already used with a different request payload';
			RETURN NEXT;
			RETURN;
		END IF;

		reservation_id := nullif(v_response->>'reservationId', '');
		status := CASE WHEN v_response->>'status' = 'RESERVED' THEN 'IDEMPOTENT_REPLAY' ELSE v_response->>'status' END;
		available_before := nullif(v_response->>'availableBefore', '')::integer;
		available_after := nullif(v_response->>'availableAfter', '')::integer;
		balance_version := nullif(v_response->>'balanceVersion', '')::integer;
		reason := CASE WHEN v_response->>'status' = 'RESERVED' THEN 'Request already applied; no duplicate reservation created' ELSE v_response->>'reason' END;
		RETURN NEXT;
		RETURN;
	END IF;

	SELECT balance.*
	INTO v_balance
	FROM inventory_balances AS balance
	INNER JOIN products AS product ON product.id = balance.product_id
	WHERE balance.organization_id = p_organization_id
		AND product.organization_id = p_organization_id
		AND product.sku = p_sku
		AND (p_warehouse_code IS NULL OR balance.warehouse_code = p_warehouse_code)
	ORDER BY balance.warehouse_code
	LIMIT 1
	FOR UPDATE OF balance;

	request_id := p_request_key;
	IF NOT FOUND THEN
		reservation_id := NULL;
		status := 'NOT_FOUND';
		available_before := NULL;
		available_after := NULL;
		balance_version := NULL;
		reason := 'Unknown SKU or warehouse for this organization';
		v_http_status := 404;
	ELSIF p_expected_version IS NOT NULL AND p_expected_version <> v_balance.version THEN
		reservation_id := NULL;
		status := 'REJECTED';
		available_before := v_balance.on_hand - v_balance.reserved - v_balance.safety_stock;
		available_after := available_before;
		balance_version := v_balance.version;
		reason := format('Version conflict: expected %s, current %s', p_expected_version, v_balance.version);
		v_http_status := 409;
	ELSIF p_quantity > (v_balance.on_hand - v_balance.reserved - v_balance.safety_stock) THEN
		reservation_id := NULL;
		status := 'REJECTED';
		available_before := v_balance.on_hand - v_balance.reserved - v_balance.safety_stock;
		available_after := available_before;
		balance_version := v_balance.version;
		reason := format('Oversell prevented; only %s units are available above safety stock', available_before);
		v_http_status := 409;
	ELSE
		v_reservation_id := 'rsv_' || substring(v_request_hash from 1 for 24);
		reservation_id := v_reservation_id;
		status := 'RESERVED';
		available_before := v_balance.on_hand - v_balance.reserved - v_balance.safety_stock;
		available_after := available_before - p_quantity;
		balance_version := v_balance.version + 1;
		reason := 'Atomic reservation accepted';
		v_http_status := 200;

		UPDATE inventory_balances AS balance
		SET reserved = balance.reserved + p_quantity,
			version = balance.version + 1,
			updated_at = now()
		WHERE balance.id = v_balance.id
			AND balance.organization_id = p_organization_id
			AND balance.version = v_balance.version;
		IF NOT FOUND THEN
			RAISE EXCEPTION 'Inventory version changed during reservation' USING ERRCODE = '40001';
		END IF;

		v_response := jsonb_build_object(
			'reservationId', reservation_id,
			'status', status,
			'requestId', request_id,
			'sku', p_sku,
			'quantity', p_quantity,
			'availableBefore', available_before,
			'availableAfter', available_after,
			'balanceVersion', balance_version,
			'reason', reason
		);

		INSERT INTO stock_reservations (
			id, organization_id, request_key, inventory_balance_id, order_id, quantity,
			status, available_before, available_after, balance_version, response
		) VALUES (
			reservation_id, p_organization_id, p_request_key, v_balance.id, p_order_id, p_quantity,
			'RESERVED', available_before, available_after, balance_version, v_response
		);

		INSERT INTO stock_movements (
			id, organization_id, inventory_balance_id, reservation_id, kind,
			quantity_delta, balance_version, metadata
		) VALUES (
			'mov_' || substring(v_request_hash from 1 for 24), p_organization_id, v_balance.id,
			reservation_id, 'RESERVATION', p_quantity, balance_version,
			jsonb_build_object('requestId', p_request_key, 'sku', p_sku, 'orderId', p_order_id)
		);

		INSERT INTO outbox_messages (
			id, organization_id, topic, aggregate_type, aggregate_id, deduplication_key, payload
		) VALUES (
			'out_' || substring(v_request_hash from 1 for 24), p_organization_id, 'inventory.reserved',
			'inventory_balance', v_balance.id, 'inventory.reserved:' || p_request_key, v_response
		);

		SELECT event.hash
		INTO v_previous_hash
		FROM audit_events AS event
		WHERE event.organization_id = p_organization_id
		ORDER BY event.sequence DESC
		LIMIT 1;
		v_previous_hash := coalesce(v_previous_hash, 'GENESIS');
		v_audit_payload := jsonb_build_object(
			'requestId', p_request_key,
			'sku', p_sku,
			'quantity', p_quantity,
			'availableBefore', available_before,
			'availableAfter', available_after,
			'balanceVersion', balance_version
		);
		v_audit_hash := encode(
			sha256(convert_to(
				concat_ws('|', v_previous_hash, 'inventory.reserved', v_balance.id, p_actor_id, v_audit_payload::text),
				'UTF8'
			)),
			'hex'
		);
		INSERT INTO audit_events (
			id, organization_id, actor_type, actor_id, action, entity_type, entity_id,
			payload, previous_hash, hash
		) VALUES (
			'aud_' || substring(v_request_hash from 1 for 24), p_organization_id, 'USER', p_actor_id,
			'inventory.reserved', 'inventory_balance', v_balance.id, v_audit_payload, v_previous_hash, v_audit_hash
		);
	END IF;

	IF v_response IS NULL THEN
		v_response := jsonb_build_object(
			'reservationId', reservation_id,
			'status', status,
			'requestId', request_id,
			'sku', p_sku,
			'quantity', p_quantity,
			'availableBefore', available_before,
			'availableAfter', available_after,
			'balanceVersion', balance_version,
			'reason', reason
		);
	END IF;

	INSERT INTO idempotency_records (
		id, organization_id, scope, idempotency_key, request_hash, status_code, response, expires_at
	) VALUES (
		'idem_' || substring(v_request_hash from 1 for 24), p_organization_id, 'inventory.reserve',
		p_request_key, v_request_hash, v_http_status, v_response, now() + interval '30 days'
	);

	RETURN NEXT;
	RETURN;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION meridian_append_audit_event(
	p_organization_id text,
	p_actor_type text,
	p_actor_id text,
	p_action text,
	p_entity_type text,
	p_entity_id text,
	p_payload jsonb,
	p_event_key text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
	v_event_id text := 'aud_' || substring(encode(sha256(convert_to(concat_ws('|', p_organization_id, p_event_key), 'UTF8')), 'hex') from 1 for 24);
	v_previous_hash text;
	v_hash text;
BEGIN
	IF EXISTS (SELECT 1 FROM audit_events WHERE id = v_event_id AND organization_id = p_organization_id) THEN
		RETURN v_event_id;
	END IF;
	PERFORM 1 FROM organizations WHERE id = p_organization_id FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'Unknown organization' USING ERRCODE = '22023'; END IF;
	SELECT event.hash INTO v_previous_hash FROM audit_events AS event
	WHERE event.organization_id = p_organization_id ORDER BY event.sequence DESC LIMIT 1;
	v_previous_hash := coalesce(v_previous_hash, 'GENESIS');
	v_hash := encode(sha256(convert_to(
		concat_ws('|', v_previous_hash, p_action, p_entity_id, p_actor_id, coalesce(p_payload, '{}'::jsonb)::text), 'UTF8')), 'hex');
	INSERT INTO audit_events (
		id, organization_id, actor_type, actor_id, action, entity_type, entity_id, payload, previous_hash, hash
	) VALUES (
		v_event_id, p_organization_id, p_actor_type, p_actor_id, p_action, p_entity_type, p_entity_id,
		coalesce(p_payload, '{}'::jsonb), v_previous_hash, v_hash
	);
	RETURN v_event_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION meridian_advance_milestone(
	p_organization_id text,
	p_actor_id text,
	p_request_key text,
	p_order_reference text
)
RETURNS TABLE (
	status text,
	request_id text,
	order_id text,
	completed_milestone_id text,
	next_milestone_id text,
	order_stage text,
	reason text
)
LANGUAGE plpgsql
AS $$
DECLARE
	v_request_hash text;
	v_existing_hash text;
	v_response jsonb;
	v_order sales_orders%ROWTYPE;
	v_current shipment_milestones%ROWTYPE;
	v_next shipment_milestones%ROWTYPE;
	v_stage order_stage;
BEGIN
	PERFORM 1 FROM organizations WHERE id = p_organization_id FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'Unknown organization' USING ERRCODE = '22023'; END IF;
	v_request_hash := encode(sha256(convert_to(concat_ws('|', p_organization_id, p_request_key, p_order_reference), 'UTF8')), 'hex');
	SELECT record.request_hash, record.response INTO v_existing_hash, v_response
	FROM idempotency_records AS record
	WHERE record.organization_id = p_organization_id AND record.scope = 'milestone.advance' AND record.idempotency_key = p_request_key;
	IF FOUND THEN
		request_id := p_request_key;
		IF v_existing_hash <> v_request_hash THEN
			status := 'IDEMPOTENCY_CONFLICT';
			order_id := NULL;
			completed_milestone_id := NULL;
			next_milestone_id := NULL;
			order_stage := NULL;
			reason := 'The idempotency key was already used with a different order';
		ELSE
			status := 'IDEMPOTENT_REPLAY';
			order_id := v_response->>'orderId';
			completed_milestone_id := nullif(v_response->>'completedMilestoneId', '');
			next_milestone_id := nullif(v_response->>'nextMilestoneId', '');
			order_stage := v_response->>'orderStage';
			reason := 'Milestone request already committed; no duplicate transition created';
		END IF;
		RETURN NEXT;
		RETURN;
	END IF;

	SELECT sales_order.* INTO v_order
	FROM sales_orders AS sales_order
	WHERE sales_order.organization_id = p_organization_id
		AND (sales_order.id = p_order_reference OR sales_order.order_number = p_order_reference)
	FOR UPDATE;
	IF NOT FOUND THEN
		status := 'NOT_FOUND'; request_id := p_request_key; order_id := NULL;
		completed_milestone_id := NULL; next_milestone_id := NULL; order_stage := NULL;
		reason := 'Order does not exist in this organization';
	ELSE
		SELECT milestone.* INTO v_current
		FROM shipment_milestones AS milestone
		INNER JOIN shipments AS shipment ON shipment.id = milestone.shipment_id
		WHERE milestone.organization_id = p_organization_id
			AND shipment.organization_id = p_organization_id
			AND shipment.sales_order_id = v_order.id
			AND milestone.status = 'CURRENT'
		ORDER BY milestone.sequence
		LIMIT 1
		FOR UPDATE OF milestone;
		IF NOT FOUND THEN
			status := 'NO_CURRENT'; request_id := p_request_key; order_id := v_order.id;
			completed_milestone_id := NULL; next_milestone_id := NULL; order_stage := v_order.stage::text;
			reason := 'No current milestone is available to advance';
		ELSE
			UPDATE shipment_milestones SET status = 'DONE', actual_at = now(), updated_at = now()
			WHERE id = v_current.id AND organization_id = p_organization_id;
			SELECT milestone.* INTO v_next
			FROM shipment_milestones AS milestone
			WHERE milestone.organization_id = p_organization_id
				AND milestone.shipment_id = v_current.shipment_id
				AND milestone.sequence > v_current.sequence
			ORDER BY milestone.sequence
			LIMIT 1
			FOR UPDATE;
			IF FOUND THEN
				UPDATE shipment_milestones SET status = 'CURRENT', updated_at = now()
				WHERE id = v_next.id AND organization_id = p_organization_id;
				v_stage := CASE v_next.kind
					WHEN 'PRODUCTION_RELEASE' THEN 'PRODUCTION'::order_stage
					WHEN 'INLINE_INSPECTION' THEN 'QUALITY_CHECK'::order_stage
					WHEN 'FINAL_INSPECTION' THEN 'QUALITY_CHECK'::order_stage
					WHEN 'VESSEL_BOOKING' THEN 'BOOKED'::order_stage
					WHEN 'EXPORT_CUSTOMS' THEN 'CUSTOMS'::order_stage
					WHEN 'DEPARTURE' THEN 'IN_TRANSIT'::order_stage
					WHEN 'ARRIVAL' THEN 'IN_TRANSIT'::order_stage
					WHEN 'DELIVERY' THEN 'DELIVERED'::order_stage
					ELSE v_order.stage
				END;
				status := 'ADVANCED';
			ELSE
				v_stage := 'DELIVERED';
				status := 'COMPLETED';
			END IF;
			UPDATE sales_orders SET stage = v_stage, version = version + 1, updated_at = now()
			WHERE id = v_order.id AND organization_id = p_organization_id;
			request_id := p_request_key;
			order_id := v_order.id;
			completed_milestone_id := v_current.id;
			next_milestone_id := CASE WHEN v_next.id IS NULL THEN NULL ELSE v_next.id END;
			order_stage := v_stage::text;
			reason := CASE WHEN status = 'COMPLETED' THEN 'All shipment milestones are complete' ELSE 'Milestone advanced atomically' END;
		END IF;
	END IF;

	v_response := jsonb_build_object(
		'status', status, 'requestId', request_id, 'orderId', order_id,
		'completedMilestoneId', completed_milestone_id, 'nextMilestoneId', next_milestone_id,
		'orderStage', order_stage, 'reason', reason
	);
	INSERT INTO idempotency_records (
		id, organization_id, scope, idempotency_key, request_hash, status_code, response, expires_at
	) VALUES (
		'idem_ms_' || substring(v_request_hash from 1 for 21), p_organization_id, 'milestone.advance',
		p_request_key, v_request_hash, CASE WHEN status IN ('ADVANCED', 'COMPLETED') THEN 200 WHEN status = 'NOT_FOUND' THEN 404 ELSE 409 END,
		v_response, now() + interval '30 days'
	);
	IF status IN ('ADVANCED', 'COMPLETED') THEN
		PERFORM meridian_append_audit_event(
			p_organization_id, 'USER', p_actor_id, 'shipment.milestone.advanced', 'sales_order', order_id,
			v_response, 'milestone.advance:' || p_request_key
		);
		INSERT INTO outbox_messages (
			id, organization_id, topic, aggregate_type, aggregate_id, deduplication_key, payload, status
		) VALUES (
			'out_ms_' || substring(v_request_hash from 1 for 22), p_organization_id, 'customer.milestone-update.draft',
			'sales_order', order_id, 'milestone.advance:' || p_request_key, v_response, 'HELD'
		);
	END IF;
	RETURN NEXT;
	RETURN;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION meridian_issue_portal_grant(
	p_organization_id text,
	p_actor_id text,
	p_request_key text,
	p_order_reference text,
	p_token_hash text,
	p_expires_in_hours integer
)
RETURNS TABLE (
	status text,
	request_id text,
	grant_id text,
	order_id text,
	customer_id text,
	grant_expires_at timestamptz,
	reason text
)
LANGUAGE plpgsql
AS $$
DECLARE
	v_request_hash text;
	v_existing_hash text;
	v_response jsonb;
	v_order sales_orders%ROWTYPE;
	v_rotated integer := 0;
BEGIN
	PERFORM 1 FROM organizations WHERE id = p_organization_id FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'Unknown organization' USING ERRCODE = '22023'; END IF;
	v_request_hash := encode(sha256(convert_to(concat_ws('|',
		p_organization_id, p_request_key, p_order_reference, p_token_hash, p_expires_in_hours::text
	), 'UTF8')), 'hex');
	SELECT record.request_hash, record.response INTO v_existing_hash, v_response
	FROM idempotency_records AS record
	WHERE record.organization_id = p_organization_id
		AND record.scope = 'portal.grant.issue'
		AND record.idempotency_key = p_request_key;
	IF FOUND THEN
		request_id := p_request_key;
		IF v_existing_hash <> v_request_hash THEN
			status := 'IDEMPOTENCY_CONFLICT';
			grant_id := NULL; order_id := NULL; customer_id := NULL; grant_expires_at := NULL;
			reason := 'The idempotency key was already used with different portal settings';
		ELSE
			status := 'IDEMPOTENT_REPLAY';
			grant_id := v_response->>'grantId';
			order_id := v_response->>'orderId';
			customer_id := v_response->>'customerId';
			grant_expires_at := (v_response->>'expiresAt')::timestamptz;
			reason := 'Portal grant already committed; the same derived token remains valid';
		END IF;
		RETURN NEXT;
		RETURN;
	END IF;

	request_id := p_request_key;
	IF p_expires_in_hours < 1 OR p_expires_in_hours > 720 THEN
		status := 'INVALID_DURATION'; grant_id := NULL; order_id := NULL; customer_id := NULL; grant_expires_at := NULL;
		reason := 'Portal access duration must be between 1 and 720 hours';
	ELSE
		SELECT sales_order.* INTO v_order
		FROM sales_orders AS sales_order
		WHERE sales_order.organization_id = p_organization_id
			AND (sales_order.id = p_order_reference OR sales_order.order_number = p_order_reference)
		FOR UPDATE;
		IF NOT FOUND THEN
			status := 'NOT_FOUND'; grant_id := NULL; order_id := NULL; customer_id := NULL; grant_expires_at := NULL;
			reason := 'Order does not exist in this organization';
		ELSE
			UPDATE portal_grants AS portal_grant
			SET status = 'REVOKED', revoked_at = now()
			WHERE portal_grant.organization_id = p_organization_id
				AND portal_grant.sales_order_id = v_order.id
				AND portal_grant.status = 'ACTIVE'
				AND portal_grant.revoked_at IS NULL;
			GET DIAGNOSTICS v_rotated = ROW_COUNT;
			grant_id := 'portal_' || substring(v_request_hash from 1 for 24);
			order_id := v_order.id;
			customer_id := v_order.customer_id;
			grant_expires_at := now() + make_interval(hours => p_expires_in_hours);
			INSERT INTO portal_grants (
				id, organization_id, customer_id, sales_order_id, token_hash, status, expires_at
			) VALUES (
				grant_id, p_organization_id, customer_id, order_id, p_token_hash, 'ACTIVE', grant_expires_at
			);
			status := 'CREATED';
			reason := CASE WHEN v_rotated > 0
				THEN 'Portal grant created and previous active links revoked'
				ELSE 'Portal grant created'
			END;
		END IF;
	END IF;

	v_response := jsonb_build_object(
		'status', status, 'requestId', request_id, 'grantId', grant_id,
		'orderId', order_id, 'customerId', customer_id, 'expiresAt', grant_expires_at, 'reason', reason
	);
	INSERT INTO idempotency_records (
		id, organization_id, scope, idempotency_key, request_hash, status_code, response, expires_at
	) VALUES (
		'idem_pg_' || substring(v_request_hash from 1 for 20), p_organization_id, 'portal.grant.issue',
		p_request_key, v_request_hash,
		CASE WHEN status = 'CREATED' THEN 201 WHEN status = 'NOT_FOUND' THEN 404 ELSE 400 END,
		v_response, now() + interval '30 days'
	);
	IF status = 'CREATED' THEN
		PERFORM meridian_append_audit_event(
			p_organization_id, 'USER', p_actor_id, 'portal.grant.issued', 'sales_order', order_id,
			jsonb_build_object('grantId', grant_id, 'orderId', order_id, 'expiresAt', grant_expires_at, 'rotatedGrants', v_rotated),
			'portal.grant.issue:' || p_request_key
		);
	END IF;
	RETURN NEXT;
	RETURN;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION meridian_create_order_intake(
	p_organization_id text,
	p_actor_id text,
	p_request_key text,
	p_payload jsonb
)
RETURNS TABLE (
	status text,
	request_id text,
	lead_id text,
	customer_id text,
	quote_id text,
	order_id text,
	reason text
)
LANGUAGE plpgsql
AS $$
DECLARE
	v_request_hash text;
	v_existing_hash text;
	v_response jsonb;
	v_company_id text;
	v_lead_id text;
	v_customer_id text;
	v_quote_id text;
	v_quote_version_id text;
	v_order_id text;
	v_due_diligence_id text;
	v_product_id text;
	v_line jsonb;
	v_line_number integer := 0;
	v_previous_hash text;
	v_audit_hash text;
	v_topic text;
	v_entity_type text;
	v_entity_id text;
	v_held boolean;
BEGIN
	IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
		RAISE EXCEPTION 'Order intake payload must be an object' USING ERRCODE = '22023';
	END IF;

	PERFORM 1 FROM organizations AS organization
	WHERE organization.id = p_organization_id
	FOR UPDATE;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Unknown organization' USING ERRCODE = '22023';
	END IF;

	v_request_hash := encode(
		sha256(convert_to(concat_ws('|', p_organization_id, p_request_key, p_payload::text), 'UTF8')),
		'hex'
	);

	SELECT record.request_hash, record.response
	INTO v_existing_hash, v_response
	FROM idempotency_records AS record
	WHERE record.organization_id = p_organization_id
		AND record.scope = 'order.intake'
		AND record.idempotency_key = p_request_key;

	IF FOUND THEN
		request_id := p_request_key;
		IF v_existing_hash <> v_request_hash THEN
			status := 'IDEMPOTENCY_CONFLICT';
			lead_id := NULL;
			customer_id := NULL;
			quote_id := NULL;
			order_id := NULL;
			reason := 'The idempotency key was already used with a different request payload';
		ELSE
			status := CASE WHEN v_response->>'status' = 'CREATED' THEN 'IDEMPOTENT_REPLAY' ELSE v_response->>'status' END;
			lead_id := nullif(v_response->>'leadId', '');
			customer_id := nullif(v_response->>'customerId', '');
			quote_id := nullif(v_response->>'quoteId', '');
			order_id := nullif(v_response->>'orderId', '');
			reason := CASE WHEN v_response->>'status' = 'CREATED' THEN 'Request already committed; no duplicate business records created' ELSE v_response->>'reason' END;
		END IF;
		RETURN NEXT;
		RETURN;
	END IF;

	IF coalesce(p_payload#>>'{company,legalName}', '') = ''
		OR coalesce(p_payload#>>'{company,countryCode}', '') = ''
		OR coalesce(p_payload#>>'{lead,sourceKey}', '') = '' THEN
		RAISE EXCEPTION 'Company legalName, countryCode, and lead sourceKey are required' USING ERRCODE = '22023';
	END IF;

	v_company_id := 'co_' || substring(encode(sha256(convert_to(
		concat_ws('|', p_organization_id, p_payload#>>'{company,legalName}', p_payload#>>'{company,countryCode}'), 'UTF8')), 'hex') from 1 for 24);
	INSERT INTO companies (
		id, organization_id, kind, legal_name, trading_name, country_code, region, industry, website, attributes
	) VALUES (
		v_company_id, p_organization_id, 'PROSPECT', p_payload#>>'{company,legalName}',
		nullif(p_payload#>>'{company,tradingName}', ''), p_payload#>>'{company,countryCode}',
		nullif(p_payload#>>'{company,region}', ''), nullif(p_payload#>>'{company,industry}', ''),
		nullif(p_payload#>>'{company,website}', ''), coalesce(p_payload#>'{company,attributes}', '{}'::jsonb)
	)
	ON CONFLICT (organization_id, legal_name, country_code)
	DO UPDATE SET
		trading_name = coalesce(EXCLUDED.trading_name, companies.trading_name),
		region = coalesce(EXCLUDED.region, companies.region),
		industry = coalesce(EXCLUDED.industry, companies.industry),
		website = coalesce(EXCLUDED.website, companies.website),
		attributes = companies.attributes || EXCLUDED.attributes,
		updated_at = now()
	RETURNING companies.id INTO v_company_id;

	v_lead_id := 'lead_' || substring(encode(sha256(convert_to(
		concat_ws('|', p_organization_id, p_payload#>>'{lead,sourceKey}'), 'UTF8')), 'hex') from 1 for 24);
	INSERT INTO leads (
		id, organization_id, company_id, source_key, stage, score, contact,
		products_wanted, score_reasons, provenance, last_signal_at
	) VALUES (
		v_lead_id, p_organization_id, v_company_id, p_payload#>>'{lead,sourceKey}', 'RESEARCHED',
		coalesce((p_payload#>>'{lead,score}')::integer, 0),
		coalesce(p_payload#>'{lead,contact}', '{}'::jsonb),
		coalesce(p_payload#>'{lead,productsWanted}', '[]'::jsonb),
		coalesce(p_payload#>'{lead,scoreReasons}', '[]'::jsonb),
		coalesce(p_payload#>'{lead,provenance}', '[]'::jsonb), now()
	)
	ON CONFLICT (organization_id, company_id)
	DO UPDATE SET
		score = EXCLUDED.score,
		contact = EXCLUDED.contact,
		products_wanted = EXCLUDED.products_wanted,
		score_reasons = EXCLUDED.score_reasons,
		provenance = leads.provenance || EXCLUDED.provenance,
		last_signal_at = now(),
		updated_at = now()
	RETURNING leads.id INTO v_lead_id;

	v_due_diligence_id := 'dd_' || substring(v_request_hash from 1 for 24);
	v_held := coalesce((p_payload#>>'{dueDiligence,humanReviewRequired}')::boolean, true)
		OR coalesce(p_payload#>>'{dueDiligence,tier}', 'HIGH') IN ('HIGH', 'BLOCKED');
	INSERT INTO due_diligence_cases (
		id, organization_id, lead_id, company_id, status, tier, risk_score,
		registration, sanctions_screen, adverse_media, human_review_required,
		flags, evidence, reviewed_at, valid_until
	) VALUES (
		v_due_diligence_id, p_organization_id, v_lead_id, v_company_id,
		CASE WHEN v_held THEN 'HELD' ELSE 'CLEARED' END,
		coalesce(p_payload#>>'{dueDiligence,tier}', 'HIGH')::risk_tier,
		coalesce((p_payload#>>'{dueDiligence,riskScore}')::integer, 100),
		coalesce(p_payload#>>'{dueDiligence,registration}', 'UNVERIFIED'),
		coalesce(p_payload#>>'{dueDiligence,sanctionsScreen}', 'UNVERIFIED'),
		coalesce(p_payload#>>'{dueDiligence,adverseMedia}', 'UNVERIFIED'),
		v_held,
		coalesce(p_payload#>'{dueDiligence,flags}', '[]'::jsonb),
		coalesce(p_payload#>'{dueDiligence,evidence}', '[]'::jsonb),
		now(), now() + interval '30 days'
	);

	IF v_held THEN
		status := 'HELD_FOR_REVIEW';
		request_id := p_request_key;
		lead_id := v_lead_id;
		customer_id := NULL;
		quote_id := NULL;
		order_id := NULL;
		reason := 'Due-diligence policy requires human review before customer or order creation';
		v_topic := 'compliance.review.required';
		v_entity_type := 'lead';
		v_entity_id := v_lead_id;
	ELSE
		UPDATE companies SET kind = 'CUSTOMER', updated_at = now() WHERE id = v_company_id AND organization_id = p_organization_id;
		UPDATE leads SET stage = 'CUSTOMER', updated_at = now() WHERE id = v_lead_id AND organization_id = p_organization_id;

		v_customer_id := 'cus_' || substring(encode(sha256(convert_to(
			concat_ws('|', p_organization_id, v_company_id), 'UTF8')), 'hex') from 1 for 24);
		INSERT INTO customers (
			id, organization_id, company_id, lead_id, segment, preferred_currency,
			preferred_incoterm, credit_limit_usd, payment_terms, next_action, next_action_at, tags
		) VALUES (
			v_customer_id, p_organization_id, v_company_id, v_lead_id,
			coalesce(p_payload#>>'{customer,segment}', 'STANDARD'),
			coalesce(p_payload#>>'{quote,currency}', 'USD'),
			coalesce(p_payload#>>'{quote,incoterm}', 'FOB'),
			coalesce((p_payload#>>'{customer,creditLimitUsd}')::numeric, 0),
			coalesce(p_payload#>>'{customer,paymentTerms}', 'PREPAYMENT'),
			'Confirm order intake and fulfillment plan', now() + interval '1 day',
			coalesce(p_payload#>'{customer,tags}', '[]'::jsonb)
		)
		ON CONFLICT (organization_id, company_id)
		DO UPDATE SET
			segment = EXCLUDED.segment,
			preferred_currency = EXCLUDED.preferred_currency,
			preferred_incoterm = EXCLUDED.preferred_incoterm,
			credit_limit_usd = EXCLUDED.credit_limit_usd,
			payment_terms = EXCLUDED.payment_terms,
			tags = EXCLUDED.tags,
			updated_at = now()
		RETURNING customers.id INTO v_customer_id;

		v_quote_id := 'quo_' || substring(v_request_hash from 1 for 24);
		v_quote_version_id := 'qv_' || substring(v_request_hash from 1 for 24);
		INSERT INTO quotes (
			id, organization_id, quote_number, customer_id, status, current_version, valid_until
		) VALUES (
			v_quote_id, p_organization_id, p_payload#>>'{quote,quoteNumber}', v_customer_id,
			'APPROVED', 1, nullif(p_payload#>>'{quote,validUntil}', '')::date
		);
		INSERT INTO quote_versions (
			id, organization_id, quote_id, version, currency, incoterm,
			exchange_rates, pricing_input, pricing_result, guardrail, approved_at
		) VALUES (
			v_quote_version_id, p_organization_id, v_quote_id, 1,
			p_payload#>>'{quote,currency}', p_payload#>>'{quote,incoterm}',
			coalesce(p_payload#>'{quote,exchangeRates}', '{}'::jsonb),
			p_payload#>'{quote}', coalesce(p_payload#>'{quote,pricingResult}', '{}'::jsonb),
			coalesce(p_payload#>>'{quote,pricingResult,guardrail}', 'REVIEW'), now()
		);

		FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload#>'{quote,lines}')
		LOOP
			v_line_number := v_line_number + 1;
			SELECT product.id INTO v_product_id
			FROM products AS product
			WHERE product.organization_id = p_organization_id AND product.sku = v_line->>'sku';
			IF NOT FOUND THEN
				RAISE EXCEPTION 'Unknown product SKU: %', v_line->>'sku' USING ERRCODE = '22023';
			END IF;
			INSERT INTO quote_lines (
				id, organization_id, quote_version_id, product_id, quantity, unit_price, unit_cost_cny, weight_kg
			) VALUES (
				v_quote_version_id || '-line-' || v_line_number, p_organization_id, v_quote_version_id,
				v_product_id, (v_line->>'quantity')::integer, (v_line->>'unitPrice')::numeric,
				(v_line->>'unitCostCny')::numeric, coalesce((v_line->>'weightKg')::numeric, 0)
			);
		END LOOP;
		IF v_line_number = 0 THEN
			RAISE EXCEPTION 'Order intake requires at least one quote line' USING ERRCODE = '22023';
		END IF;

		v_order_id := 'ord_' || substring(v_request_hash from 1 for 24);
		INSERT INTO sales_orders (
			id, organization_id, order_number, customer_id, quote_version_id, customer_po_number,
			stage, currency, incoterm, amount_usd, destination, estimated_departure,
			estimated_arrival, container
		) VALUES (
			v_order_id, p_organization_id, p_payload#>>'{order,orderNumber}', v_customer_id,
			v_quote_version_id, nullif(p_payload#>>'{order,customerPoNumber}', ''), 'SIGNED',
			p_payload#>>'{quote,currency}', p_payload#>>'{quote,incoterm}',
			(p_payload#>>'{quote,pricingResult,revenueUsd}')::numeric,
			p_payload#>>'{order,destination}', nullif(p_payload#>>'{order,estimatedDeparture}', '')::date,
			nullif(p_payload#>>'{order,estimatedArrival}', '')::date, nullif(p_payload#>>'{order,container}', '')
		);
		INSERT INTO sales_order_lines (
			id, organization_id, order_id, product_id, quantity, unit_price
		)
		SELECT
			v_order_id || '-line-' || row_number() OVER (ORDER BY line.id),
			p_organization_id, v_order_id, line.product_id, line.quantity, line.unit_price
		FROM quote_lines AS line
		WHERE line.organization_id = p_organization_id AND line.quote_version_id = v_quote_version_id;

		status := 'CREATED';
		request_id := p_request_key;
		lead_id := v_lead_id;
		customer_id := v_customer_id;
		quote_id := v_quote_id;
		order_id := v_order_id;
		reason := 'Lead, diligence, customer, quote, and order committed atomically';
		v_topic := 'order.created';
		v_entity_type := 'sales_order';
		v_entity_id := v_order_id;
	END IF;

	v_response := jsonb_build_object(
		'status', status,
		'requestId', request_id,
		'leadId', lead_id,
		'customerId', customer_id,
		'quoteId', quote_id,
		'orderId', order_id,
		'reason', reason
	);

	SELECT event.hash INTO v_previous_hash
	FROM audit_events AS event
	WHERE event.organization_id = p_organization_id
	ORDER BY event.sequence DESC
	LIMIT 1;
	v_previous_hash := coalesce(v_previous_hash, 'GENESIS');
	v_audit_hash := encode(sha256(convert_to(
		concat_ws('|', v_previous_hash, v_topic, v_entity_id, p_actor_id, v_response::text), 'UTF8')), 'hex');
	INSERT INTO audit_events (
		id, organization_id, actor_type, actor_id, action, entity_type, entity_id,
		payload, previous_hash, hash
	) VALUES (
		'aud_intake_' || substring(v_request_hash from 1 for 20), p_organization_id, 'USER', p_actor_id,
		v_topic, v_entity_type, v_entity_id, v_response, v_previous_hash, v_audit_hash
	);

	INSERT INTO outbox_messages (
		id, organization_id, topic, aggregate_type, aggregate_id, deduplication_key, payload,
		status
	) VALUES (
		'out_intake_' || substring(v_request_hash from 1 for 20), p_organization_id, v_topic,
		v_entity_type, v_entity_id, 'order.intake:' || p_request_key, v_response,
		CASE WHEN v_held THEN 'HELD'::message_status ELSE 'PENDING'::message_status END
	);

	INSERT INTO idempotency_records (
		id, organization_id, scope, idempotency_key, request_hash, status_code, response, expires_at
	) VALUES (
		'idem_intake_' || substring(v_request_hash from 1 for 19), p_organization_id, 'order.intake',
		p_request_key, v_request_hash, CASE WHEN v_held THEN 202 ELSE 201 END,
		v_response, now() + interval '30 days'
	);

	RETURN NEXT;
	RETURN;
END;
$$;
