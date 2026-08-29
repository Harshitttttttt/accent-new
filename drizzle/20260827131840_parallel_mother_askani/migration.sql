CREATE TYPE "vendor_quotation_status" AS ENUM('draft', 'sent', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "vendor_quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"quotation_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_paise" bigint DEFAULT 0 NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chk_vendor_quotation_item_qty_positive" CHECK ("quantity" > 0),
	CONSTRAINT "chk_vendor_quotation_item_prices_nonnegative" CHECK ("unit_price_paise" >= 0 and "amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"quotation_number" varchar(24) NOT NULL UNIQUE,
	"quotation_date" date,
	"vendor_id" uuid,
	"vendor_name" varchar(255) NOT NULL,
	"vendor_email" varchar(255),
	"vendor_phone" varchar(50),
	"vendor_address" text,
	"subject" varchar(500),
	"project_id" uuid,
	"tax_rate_bps" integer DEFAULT 1800 NOT NULL,
	"manual_subtotal_paise" bigint,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_amount_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"valid_until" date,
	"notes" text,
	"terms" text,
	"status" "vendor_quotation_status" DEFAULT 'draft'::"vendor_quotation_status" NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_vendor_quotations_rate_range" CHECK ("tax_rate_bps" between 0 and 10000),
	CONSTRAINT "chk_vendor_quotations_amounts_nonnegative" CHECK ("manual_subtotal_paise" >= 0 and "discount_paise" >= 0 and "tax_amount_paise" >= 0 and "total_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX "idx_vendor_quotation_items_quotation" ON "vendor_quotation_items" ("quotation_id","position");--> statement-breakpoint
CREATE INDEX "idx_vendor_quotations_vendor_id" ON "vendor_quotations" ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_quotations_project_id" ON "vendor_quotations" ("project_id");--> statement-breakpoint
CREATE INDEX "idx_vendor_quotations_quotation_date" ON "vendor_quotations" ("quotation_date");--> statement-breakpoint
CREATE INDEX "idx_vendor_quotations_active_status" ON "vendor_quotations" ("status") WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "vendor_quotation_items" ADD CONSTRAINT "vendor_quotation_items_quotation_id_vendor_quotations_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "vendor_quotations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vendor_quotations" ADD CONSTRAINT "vendor_quotations_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "vendor_quotations" ADD CONSTRAINT "vendor_quotations_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "vendor_quotations" ADD CONSTRAINT "vendor_quotations_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "vendor_quotations" ADD CONSTRAINT "vendor_quotations_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;