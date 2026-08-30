DO $$ BEGIN
  CREATE TYPE "client_purchase_order_status" AS ENUM('draft', 'acknowledged', 'in_progress', 'fulfilled', 'on_hold', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ticket_category" AS ENUM('it_support', 'software_license', 'hardware', 'admin', 'hr', 'billing', 'access_request', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ticket_status" AS ENUM('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "vendor_purchase_order_status" AS ENUM('draft', 'pending_approval', 'approved', 'issued', 'partially_received', 'fulfilled', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_ticket_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ticket_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_name" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ticket_id" uuid NOT NULL,
	"author_user_id" uuid,
	"author_name" varchar(255) NOT NULL,
	"author_role" varchar(50) DEFAULT 'staff' NOT NULL,
	"message" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ticket_number" varchar(20) NOT NULL UNIQUE,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" "ticket_category" DEFAULT 'it_support'::"ticket_category" NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium'::"ticket_priority" NOT NULL,
	"status" "ticket_status" DEFAULT 'open'::"ticket_status" NOT NULL,
	"requester_id" uuid,
	"requester_name" varchar(255) NOT NULL,
	"requester_email" varchar(255),
	"assigned_to" uuid,
	"related_project_id" varchar(80),
	"due_date" date,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_notes" text,
	"tags" text[],
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_purchase_order_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_name" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"item_code" varchar(100),
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" varchar(50) DEFAULT 'nos' NOT NULL,
	"unit_price_paise" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 1800 NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_client_po_items_qty_positive" CHECK ("quantity" > 0),
	CONSTRAINT "chk_client_po_items_prices_nonneg" CHECK ("unit_price_paise" >= 0 and "amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_number" varchar(24) NOT NULL UNIQUE,
	"client_po_number" varchar(100) NOT NULL,
	"company_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"client_contact_name" varchar(255),
	"client_contact_email" varchar(255),
	"client_contact_phone" varchar(50),
	"billing_address" text,
	"shipping_address" text,
	"client_gstin" varchar(20),
	"client_pan" varchar(20),
	"proposal_id" uuid,
	"project_id" uuid,
	"subject" varchar(500),
	"po_date" date,
	"received_date" date DEFAULT now(),
	"delivery_due_date" date,
	"status" "client_purchase_order_status" DEFAULT 'draft'::"client_purchase_order_status" NOT NULL,
	"priority" "lead_priority" DEFAULT 'medium'::"lead_priority" NOT NULL,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 1800 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"cgst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"sgst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"igst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_amount_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"invoiced_amount_paise" bigint DEFAULT 0 NOT NULL,
	"remaining_amount_paise" bigint DEFAULT 0 NOT NULL,
	"payment_terms" text,
	"delivery_terms" text,
	"scope_of_work" text,
	"special_instructions" text,
	"attachment_url" varchar(500),
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_client_pos_rate_range" CHECK ("tax_rate_bps" between 0 and 10000),
	CONSTRAINT "chk_client_pos_amounts_nonneg" CHECK ("subtotal_paise" >= 0 and "discount_paise" >= 0 and "tax_amount_paise" >= 0 and "total_paise" >= 0 and "invoiced_amount_paise" >= 0 and "remaining_amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_purchase_order_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"po_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_name" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"po_id" uuid NOT NULL,
	"item_code" varchar(100),
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" varchar(50) DEFAULT 'nos' NOT NULL,
	"unit_price_paise" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 1800 NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_vendor_po_items_qty_positive" CHECK ("quantity" > 0),
	CONSTRAINT "chk_vendor_po_items_prices_nonneg" CHECK ("unit_price_paise" >= 0 and "amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"po_number" varchar(24) NOT NULL UNIQUE,
	"vendor_id" uuid,
	"vendor_name" varchar(255) NOT NULL,
	"vendor_email" varchar(255),
	"vendor_phone" varchar(50),
	"vendor_address" text,
	"vendor_gstin" varchar(20),
	"vendor_pan" varchar(20),
	"vendor_quotation_id" uuid,
	"project_id" uuid,
	"subject" varchar(500),
	"po_date" date,
	"expected_delivery_date" date,
	"status" "vendor_purchase_order_status" DEFAULT 'draft'::"vendor_purchase_order_status" NOT NULL,
	"priority" "lead_priority" DEFAULT 'medium'::"lead_priority" NOT NULL,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 1800 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"cgst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"sgst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"igst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_amount_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"billed_amount_paise" bigint DEFAULT 0 NOT NULL,
	"balance_amount_paise" bigint DEFAULT 0 NOT NULL,
	"delivery_terms" text,
	"payment_terms" text,
	"shipping_address" text,
	"mode_of_delivery" varchar(100),
	"attachment_url" varchar(500),
	"notes" text,
	"terms" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_vendor_pos_rate_range" CHECK ("tax_rate_bps" between 0 and 10000),
	CONSTRAINT "chk_vendor_pos_amounts_nonneg" CHECK ("subtotal_paise" >= 0 and "discount_paise" >= 0 and "tax_amount_paise" >= 0 and "total_paise" >= 0 and "billed_amount_paise" >= 0 and "balance_amount_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_activities_ticket_id" ON "support_ticket_activities" ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_comments_ticket_id" ON "support_ticket_comments" ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_status" ON "support_tickets" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_priority" ON "support_tickets" ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_category" ON "support_tickets" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_assigned_to" ON "support_tickets" ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_requester_id" ON "support_tickets" ("requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_created_at" ON "support_tickets" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_po_activities_order" ON "client_purchase_order_activities" ("order_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_po_items_order" ON "client_purchase_order_items" ("order_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_pos_company_id" ON "client_purchase_orders" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_pos_project_id" ON "client_purchase_orders" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_pos_proposal_id" ON "client_purchase_orders" ("proposal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_pos_po_date" ON "client_purchase_orders" ("po_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_pos_client_po_num" ON "client_purchase_orders" ("client_po_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_pos_active_status" ON "client_purchase_orders" ("status") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_pos_active_created" ON "client_purchase_orders" ("created_at") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_po_activities_po" ON "vendor_purchase_order_activities" ("po_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_po_items_po" ON "vendor_purchase_order_items" ("po_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_pos_vendor_id" ON "vendor_purchase_orders" ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_pos_project_id" ON "vendor_purchase_orders" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_pos_quotation_id" ON "vendor_purchase_orders" ("vendor_quotation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_pos_po_date" ON "vendor_purchase_orders" ("po_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_pos_active_status" ON "vendor_purchase_orders" ("status") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendor_pos_active_created" ON "vendor_purchase_orders" ("created_at") WHERE deleted_at is null;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_ticket_activities" ADD CONSTRAINT "support_ticket_activities_ticket_id_support_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_ticket_activities" ADD CONSTRAINT "support_ticket_activities_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_ticket_comments" ADD CONSTRAINT "support_ticket_comments_ticket_id_support_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_ticket_comments" ADD CONSTRAINT "support_ticket_comments_author_user_id_users_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_id_users_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_employees_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "employees"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_related_project_id_crm_projects_id_fkey" FOREIGN KEY ("related_project_id") REFERENCES "crm_projects"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_users_id_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_order_activities" ADD CONSTRAINT "client_purchase_order_activities_uk0eQrt2przV_fkey" FOREIGN KEY ("order_id") REFERENCES "client_purchase_orders"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_order_activities" ADD CONSTRAINT "client_purchase_order_activities_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_order_items" ADD CONSTRAINT "client_purchase_order_items_ODE7m1diqR5m_fkey" FOREIGN KEY ("order_id") REFERENCES "client_purchase_orders"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_orders" ADD CONSTRAINT "client_purchase_orders_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_orders" ADD CONSTRAINT "client_purchase_orders_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_orders" ADD CONSTRAINT "client_purchase_orders_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_orders" ADD CONSTRAINT "client_purchase_orders_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_orders" ADD CONSTRAINT "client_purchase_orders_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_purchase_orders" ADD CONSTRAINT "client_purchase_orders_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_order_activities" ADD CONSTRAINT "vendor_purchase_order_activities_o4mVNgYCGyhq_fkey" FOREIGN KEY ("po_id") REFERENCES "vendor_purchase_orders"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_order_activities" ADD CONSTRAINT "vendor_purchase_order_activities_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_order_items" ADD CONSTRAINT "vendor_purchase_order_items_UupF3crpdvXj_fkey" FOREIGN KEY ("po_id") REFERENCES "vendor_purchase_orders"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_orders" ADD CONSTRAINT "vendor_purchase_orders_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_orders" ADD CONSTRAINT "vendor_purchase_orders_emQKA4VafPQf_fkey" FOREIGN KEY ("vendor_quotation_id") REFERENCES "vendor_quotations"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_orders" ADD CONSTRAINT "vendor_purchase_orders_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_orders" ADD CONSTRAINT "vendor_purchase_orders_approved_by_users_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_orders" ADD CONSTRAINT "vendor_purchase_orders_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_orders" ADD CONSTRAINT "vendor_purchase_orders_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "vendor_purchase_orders" ADD CONSTRAINT "vendor_purchase_orders_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;