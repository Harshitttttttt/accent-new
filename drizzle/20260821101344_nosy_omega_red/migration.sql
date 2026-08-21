CREATE TYPE "lead_enquiry_type" AS ENUM('Email', 'Phone', 'Meeting', 'WhatsApp', 'Tender', 'Other');--> statement-breakpoint
CREATE TABLE "lead_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"lead_id" uuid NOT NULL,
	"from_stage" "lead_stage",
	"to_stage" "lead_stage" NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_leads_stage";--> statement-breakpoint
DROP INDEX "idx_leads_assigned_to";--> statement-breakpoint
DROP INDEX "idx_leads_deleted_at";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "enquiry_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "enquiry_type" SET DATA TYPE "lead_enquiry_type" USING "enquiry_type"::"lead_enquiry_type";--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "enquiry_type" SET DEFAULT 'Email'::"lead_enquiry_type";--> statement-breakpoint
CREATE INDEX "idx_lead_stage_history_lead" ON "lead_stage_history" ("lead_id","changed_at");--> statement-breakpoint
CREATE INDEX "idx_leads_contact_email" ON "leads" ("contact_email");--> statement-breakpoint
CREATE INDEX "idx_leads_active_assigned_stage" ON "leads" ("assigned_to","stage") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "idx_leads_active_stage" ON "leads" ("stage") WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_changed_by_users_id_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "chk_leads_value_nonnegative" CHECK ("value_paise" >= 0);--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "chk_leads_probability_range" CHECK ("probability" between 0 and 100);--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "chk_leads_score_range" CHECK ("score" between 0 and 100);
