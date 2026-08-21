CREATE TYPE "company_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "lead_source_code" AS ENUM('website', 'linkedin', 'referral', 'existing_client', 'cold_call', 'tender_portal', 'exhibition', 'other');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(50) UNIQUE,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"website" varchar(255),
	"industry" varchar(100),
	"gstin" varchar(15),
	"pan" varchar(10),
	"address_line_1" text,
	"address_line_2" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100) DEFAULT 'India',
	"postal_code" varchar(20),
	"inquiry_email" varchar(255),
	"notes" text,
	"status" "company_status" DEFAULT 'active'::"company_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"type" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(50),
	"designation" varchar(100),
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" "lead_source_code" NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_companies_code" ON "companies" ("code");--> statement-breakpoint
CREATE INDEX "idx_companies_name" ON "companies" ("name");--> statement-breakpoint
CREATE INDEX "idx_companies_status" ON "companies" ("status");--> statement-breakpoint
CREATE INDEX "idx_companies_city" ON "companies" ("city");--> statement-breakpoint
CREATE INDEX "idx_company_emails_company" ON "company_emails" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_company" ON "contacts" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "contacts" ("email");--> statement-breakpoint
ALTER TABLE "company_emails" ADD CONSTRAINT "company_emails_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;