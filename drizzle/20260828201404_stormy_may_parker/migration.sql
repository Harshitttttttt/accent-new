CREATE TYPE "gst_type" AS ENUM('cgst_sgst', 'igst');--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM('unpaid', 'partial', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "purchase_invoice_status" AS ENUM('draft', 'pending', 'approved', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "sale_invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TABLE "purchase_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_paise" bigint DEFAULT 0 NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_purchase_invoice_line_qty_positive" CHECK ("quantity" > 0),
	CONSTRAINT "chk_purchase_invoice_line_prices_nonneg" CHECK ("unit_price_paise" >= 0 and "amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_number" varchar(24) NOT NULL CONSTRAINT "uq_purchase_invoices_number_active" UNIQUE,
	"invoice_date" date,
	"due_date" date,
	"vendor_id" uuid,
	"vendor_name" varchar(255) NOT NULL,
	"vendor_email" varchar(255),
	"vendor_phone" varchar(50),
	"vendor_address" text,
	"vendor_gstin" varchar(20),
	"vendor_pan" varchar(20),
	"project_id" uuid,
	"po_number" varchar(100),
	"po_date" date,
	"description" varchar(500),
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 1800 NOT NULL,
	"cgst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"sgst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"igst_amount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_amount_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"amount_paid_paise" bigint DEFAULT 0 NOT NULL,
	"balance_due_paise" bigint DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid'::"payment_status" NOT NULL,
	"notes" text,
	"terms" text,
	"attachment_url" varchar(500),
	"status" "purchase_invoice_status" DEFAULT 'draft'::"purchase_invoice_status" NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_purchase_invoices_rate_range" CHECK ("tax_rate_bps" between 0 and 10000),
	CONSTRAINT "chk_purchase_invoices_amounts_nonneg" CHECK ("subtotal_paise" >= 0 and "discount_paise" >= 0 and "tax_amount_paise" >= 0 and "total_paise" >= 0 and "amount_paid_paise" >= 0 and "balance_due_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_paise" bigint DEFAULT 0 NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_sale_invoice_line_qty_positive" CHECK ("quantity" > 0),
	CONSTRAINT "chk_sale_invoice_line_prices_nonneg" CHECK ("unit_price_paise" >= 0 and "amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_number" varchar(24) NOT NULL CONSTRAINT "uq_sale_invoices_number_active" UNIQUE,
	"invoice_date" date,
	"due_date" date,
	"company_id" uuid,
	"client_name" varchar(255) NOT NULL,
	"client_email" varchar(255),
	"client_phone" varchar(50),
	"client_address" text,
	"client_gstin" varchar(20),
	"client_pan" varchar(20),
	"client_state" varchar(100),
	"client_state_code" varchar(10),
	"kind_attn" varchar(255),
	"project_id" uuid,
	"po_number" varchar(100),
	"po_date" date,
	"original_po_value_paise" bigint,
	"balance_po_value_paise" bigint,
	"description" varchar(500),
	"gst_number" varchar(20),
	"pan_number" varchar(20),
	"tan_number" varchar(20),
	"service_category" varchar(500),
	"bank_address" varchar(500),
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"gst_type" "gst_type" DEFAULT 'cgst_sgst'::"gst_type" NOT NULL,
	"cgst_rate_bps" integer DEFAULT 900 NOT NULL,
	"sgst_rate_bps" integer DEFAULT 900 NOT NULL,
	"igst_rate_bps" integer DEFAULT 1800 NOT NULL,
	"tax_amount_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"amount_paid_paise" bigint DEFAULT 0 NOT NULL,
	"balance_due_paise" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"terms" text,
	"status" "sale_invoice_status" DEFAULT 'draft'::"sale_invoice_status" NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_sale_invoices_gst_rates_range" CHECK ("cgst_rate_bps" between 0 and 10000 and "sgst_rate_bps" between 0 and 10000 and "igst_rate_bps" between 0 and 10000),
	CONSTRAINT "chk_sale_invoices_amounts_nonneg" CHECK ("subtotal_paise" >= 0 and "discount_paise" >= 0 and "tax_amount_paise" >= 0 and "total_paise" >= 0 and "amount_paid_paise" >= 0 and "balance_due_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX "idx_purchase_invoice_lines_invoice" ON "purchase_invoice_lines" ("invoice_id","position");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoices_vendor" ON "purchase_invoices" ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoices_project" ON "purchase_invoices" ("project_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoices_invoice_date" ON "purchase_invoices" ("invoice_date");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoices_due_date" ON "purchase_invoices" ("due_date");--> statement-breakpoint
CREATE INDEX "idx_purchase_invoices_active_status" ON "purchase_invoices" ("status") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "idx_purchase_invoices_payment_status" ON "purchase_invoices" ("payment_status") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "idx_purchase_invoices_active_created" ON "purchase_invoices" ("created_at") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "idx_sale_invoice_lines_invoice" ON "sale_invoice_lines" ("invoice_id","position");--> statement-breakpoint
CREATE INDEX "idx_sale_invoices_company" ON "sale_invoices" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_sale_invoices_project" ON "sale_invoices" ("project_id");--> statement-breakpoint
CREATE INDEX "idx_sale_invoices_invoice_date" ON "sale_invoices" ("invoice_date");--> statement-breakpoint
CREATE INDEX "idx_sale_invoices_due_date" ON "sale_invoices" ("due_date");--> statement-breakpoint
CREATE INDEX "idx_sale_invoices_active_status" ON "sale_invoices" ("status") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "idx_sale_invoices_active_created" ON "sale_invoices" ("created_at") WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_invoice_id_purchase_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sale_invoice_lines" ADD CONSTRAINT "sale_invoice_lines_invoice_id_sale_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sale_invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sale_invoices" ADD CONSTRAINT "sale_invoices_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;