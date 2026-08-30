CREATE TYPE "client_payment_status" AS ENUM('draft', 'pending_clearance', 'cleared', 'bounced', 'cancelled');--> statement-breakpoint
CREATE TYPE "client_payment_type" AS ENUM('invoice_payment', 'advance_payment', 'retention_release', 'security_deposit', 'other');--> statement-breakpoint
CREATE TYPE "payment_mode" AS ENUM('neft', 'rtgs', 'imps', 'cheque', 'upi', 'bank_transfer', 'wire_transfer', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "payment_release_status" AS ENUM('draft', 'pending_approval', 'approved', 'processed', 'cleared', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "payment_release_type" AS ENUM('advance_refund', 'security_deposit_refund', 'retention_release', 'excess_payment_refund', 'credit_settlement', 'other');--> statement-breakpoint
CREATE TABLE "client_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"allocated_amount_paise" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_payment_allocations_amount_pos" CHECK ("allocated_amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "client_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"receipt_number" varchar(24) NOT NULL UNIQUE,
	"company_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"project_id" uuid,
	"project_name" varchar(255),
	"invoice_id" uuid,
	"invoice_number" varchar(50),
	"client_po_id" uuid,
	"client_po_number" varchar(100),
	"bank_id" uuid,
	"bank_name" varchar(150),
	"bank_account_number" varchar(50),
	"payment_date" date NOT NULL,
	"payment_type" "client_payment_type" DEFAULT 'invoice_payment'::"client_payment_type" NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'neft'::"payment_mode" NOT NULL,
	"transaction_reference" varchar(100),
	"cheque_date" date,
	"cheque_bank" varchar(150),
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"tds_deducted_paise" bigint DEFAULT 0 NOT NULL,
	"bank_charges_paise" bigint DEFAULT 0 NOT NULL,
	"net_amount_paise" bigint DEFAULT 0 NOT NULL,
	"status" "client_payment_status" DEFAULT 'cleared'::"client_payment_status" NOT NULL,
	"notes" text,
	"receipt_url" varchar(500),
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_client_payments_amounts_nonneg" CHECK ("amount_paise" >= 0 and "tds_deducted_paise" >= 0 and "bank_charges_paise" >= 0 and "net_amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"entity_type" varchar(20) NOT NULL,
	"entity_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_name" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments_released" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"payment_number" varchar(24) NOT NULL UNIQUE,
	"company_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"project_id" uuid,
	"project_name" varchar(255),
	"sale_invoice_id" uuid,
	"invoice_number" varchar(50),
	"disbursing_bank_id" uuid,
	"disbursing_bank_name" varchar(150),
	"client_bank_name" varchar(150),
	"client_account_number" varchar(50),
	"client_ifsc_code" varchar(11),
	"release_date" date NOT NULL,
	"release_type" "payment_release_type" DEFAULT 'advance_refund'::"payment_release_type" NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'neft'::"payment_mode" NOT NULL,
	"transaction_reference" varchar(100),
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"deduction_paise" bigint DEFAULT 0 NOT NULL,
	"net_amount_paise" bigint DEFAULT 0 NOT NULL,
	"status" "payment_release_status" DEFAULT 'draft'::"payment_release_status" NOT NULL,
	"reason" varchar(500),
	"notes" text,
	"attachment_url" varchar(500),
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_payments_released_amounts_nonneg" CHECK ("amount_paise" >= 0 and "deduction_paise" >= 0 and "net_amount_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_payment" ON "client_payment_allocations" ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_invoice" ON "client_payment_allocations" ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_client_payments_company" ON "client_payments" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_client_payments_project" ON "client_payments" ("project_id");--> statement-breakpoint
CREATE INDEX "idx_client_payments_invoice" ON "client_payments" ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_client_payments_bank" ON "client_payments" ("bank_id");--> statement-breakpoint
CREATE INDEX "idx_client_payments_date" ON "client_payments" ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_client_payments_active_status" ON "client_payments" ("status") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "idx_client_payments_active_created" ON "client_payments" ("created_at") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "idx_payment_activities_entity" ON "payment_activities" ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_released_company" ON "payments_released" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_payments_released_project" ON "payments_released" ("project_id");--> statement-breakpoint
CREATE INDEX "idx_payments_released_disbursing_bank" ON "payments_released" ("disbursing_bank_id");--> statement-breakpoint
CREATE INDEX "idx_payments_released_date" ON "payments_released" ("release_date");--> statement-breakpoint
CREATE INDEX "idx_payments_released_active_status" ON "payments_released" ("status") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "idx_payments_released_active_created" ON "payments_released" ("created_at") WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "client_payment_allocations" ADD CONSTRAINT "client_payment_allocations_payment_id_client_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "client_payments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "client_payment_allocations" ADD CONSTRAINT "client_payment_allocations_invoice_id_sale_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sale_invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_invoice_id_sale_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sale_invoices"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_client_po_id_client_purchase_orders_id_fkey" FOREIGN KEY ("client_po_id") REFERENCES "client_purchase_orders"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_bank_id_banks_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payment_activities" ADD CONSTRAINT "payment_activities_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_released" ADD CONSTRAINT "payments_released_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_released" ADD CONSTRAINT "payments_released_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_released" ADD CONSTRAINT "payments_released_sale_invoice_id_sale_invoices_id_fkey" FOREIGN KEY ("sale_invoice_id") REFERENCES "sale_invoices"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_released" ADD CONSTRAINT "payments_released_disbursing_bank_id_banks_id_fkey" FOREIGN KEY ("disbursing_bank_id") REFERENCES "banks"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_released" ADD CONSTRAINT "payments_released_approved_by_users_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_released" ADD CONSTRAINT "payments_released_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_released" ADD CONSTRAINT "payments_released_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments_released" ADD CONSTRAINT "payments_released_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;