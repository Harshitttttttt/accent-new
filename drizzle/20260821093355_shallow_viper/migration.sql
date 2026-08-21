CREATE TYPE "lead_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "lead_stage" AS ENUM('prospecting', 'qualified', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"lead_number" varchar(20) NOT NULL UNIQUE,
	"company_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(20),
	"designation" varchar(100),
	"inquiry_email" varchar(255),
	"cc_emails" text[],
	"city" varchar(100),
	"project_description" text,
	"enquiry_type" varchar(50) DEFAULT 'Email' NOT NULL,
	"source_code" "lead_source_code" DEFAULT 'website'::"lead_source_code" NOT NULL,
	"stage" "lead_stage" DEFAULT 'prospecting'::"lead_stage" NOT NULL,
	"priority" "lead_priority" DEFAULT 'medium'::"lead_priority" NOT NULL,
	"value_paise" bigint,
	"probability" integer,
	"score" integer,
	"assigned_to" uuid,
	"created_by" uuid,
	"enquiry_date" date DEFAULT now() NOT NULL,
	"expected_close_date" date,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_leads_company_id" ON "leads" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_leads_company_name" ON "leads" ("company_name");--> statement-breakpoint
CREATE INDEX "idx_leads_stage" ON "leads" ("stage");--> statement-breakpoint
CREATE INDEX "idx_leads_assigned_to" ON "leads" ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_leads_source_code" ON "leads" ("source_code");--> statement-breakpoint
CREATE INDEX "idx_leads_enquiry_date" ON "leads" ("enquiry_date");--> statement-breakpoint
CREATE INDEX "idx_leads_deleted_at" ON "leads" ("deleted_at");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_employees_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "employees"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
