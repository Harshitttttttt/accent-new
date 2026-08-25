CREATE TYPE "proposal_contract_type" AS ENUM('lumpsum', 'manhours_basis', 'line_wise');--> statement-breakpoint
CREATE TYPE "proposal_status" AS ENUM('draft', 'internal_review', 'sent', 'negotiation', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "proposal_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"note" text NOT NULL,
	"done_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_input_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_quotation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_paise" bigint DEFAULT 0 NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_proposal_quote_qty_positive" CHECK ("quantity" > 0),
	CONSTRAINT "chk_proposal_quote_prices_nonnegative" CHECK ("unit_price_paise" >= 0 and "amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "proposal_software" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_id" uuid NOT NULL,
	"software_id" uuid,
	"name" varchar(255) NOT NULL,
	"notes" varchar(500),
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_id" uuid NOT NULL,
	"from_status" "proposal_status",
	"to_status" "proposal_status" NOT NULL,
	"note" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"proposal_number" varchar(24) NOT NULL UNIQUE,
	"lead_id" uuid,
	"company_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "proposal_status" DEFAULT 'draft'::"proposal_status" NOT NULL,
	"priority" "lead_priority" DEFAULT 'medium'::"lead_priority" NOT NULL,
	"contract_type" "proposal_contract_type" DEFAULT 'lumpsum'::"proposal_contract_type" NOT NULL,
	"value_paise" bigint,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(20),
	"designation" varchar(100),
	"city" varchar(100),
	"site_location" varchar(255),
	"scope_of_work" text,
	"planned_start_date" date,
	"planned_end_date" date,
	"due_date" date,
	"mode_of_delivery" varchar(100),
	"revisions_included" integer DEFAULT 1 NOT NULL,
	"site_visits" integer DEFAULT 0 NOT NULL,
	"site_visit_notes" text,
	"validity_days" integer,
	"estimated_cost_paise" bigint,
	"commercial_notes" text,
	"payment_terms" text,
	"other_terms" text,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_proposals_value_nonnegative" CHECK ("value_paise" >= 0),
	CONSTRAINT "chk_proposals_cost_nonnegative" CHECK ("estimated_cost_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX "idx_proposal_comments_proposal" ON "proposal_comments" ("proposal_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_proposal_deliverables_proposal" ON "proposal_deliverables" ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "idx_proposal_exclusions_proposal" ON "proposal_exclusions" ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "idx_proposal_follow_ups_proposal" ON "proposal_follow_ups" ("proposal_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_proposal_input_docs_proposal" ON "proposal_input_documents" ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "idx_proposal_quote_lines_proposal" ON "proposal_quotation_lines" ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "idx_proposal_software_proposal" ON "proposal_software" ("proposal_id","position");--> statement-breakpoint
CREATE INDEX "idx_proposal_software_master" ON "proposal_software" ("software_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_status_history_proposal" ON "proposal_status_history" ("proposal_id","changed_at");--> statement-breakpoint
CREATE INDEX "idx_proposals_status" ON "proposals" ("status");--> statement-breakpoint
CREATE INDEX "idx_proposals_company" ON "proposals" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_proposals_lead" ON "proposals" ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_proposals_active_created" ON "proposals" ("created_at") WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "proposal_deliverables" ADD CONSTRAINT "proposal_deliverables_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_exclusions" ADD CONSTRAINT "proposal_exclusions_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_follow_ups" ADD CONSTRAINT "proposal_follow_ups_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_follow_ups" ADD CONSTRAINT "proposal_follow_ups_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "proposal_input_documents" ADD CONSTRAINT "proposal_input_documents_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_quotation_lines" ADD CONSTRAINT "proposal_quotation_lines_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_software" ADD CONSTRAINT "proposal_software_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_software" ADD CONSTRAINT "proposal_software_software_id_software_masters_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software_masters"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "proposal_status_history" ADD CONSTRAINT "proposal_status_history_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_status_history" ADD CONSTRAINT "proposal_status_history_changed_by_users_id_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;