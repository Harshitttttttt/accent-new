ALTER TABLE "companies" ADD COLUMN "account_manager_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
DROP TYPE "company_status";--> statement-breakpoint
CREATE TYPE "company_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "status" SET DATA TYPE "company_status" USING "status"::"company_status";--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "status" SET DEFAULT 'active'::"company_status";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "uq_contacts_company_email" UNIQUE("company_id","email");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_gstin_key" UNIQUE("gstin");--> statement-breakpoint
CREATE INDEX "idx_companies_account_mgr" ON "companies" ("account_manager_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_account_manager_id_employees_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "employees"("id") ON DELETE SET NULL;