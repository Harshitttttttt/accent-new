CREATE TYPE "assignment_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "assignment_status" AS ENUM('not_started', 'in_progress', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "project_activity_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"discipline_id" uuid,
	"activity_id" uuid,
	"sub_activity_id" uuid,
	"discipline_name" varchar(150) NOT NULL,
	"activity_name" varchar(150) NOT NULL,
	"sub_activity_name" varchar(150),
	"assignee_id" uuid,
	"planned_minutes" integer DEFAULT 0 NOT NULL,
	"quantity" integer,
	"due_date" date,
	"priority" "assignment_priority" DEFAULT 'medium'::"assignment_priority" NOT NULL,
	"status" "assignment_status" DEFAULT 'not_started'::"assignment_status" NOT NULL,
	"remark" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_paa_planned_nonnegative" CHECK ("planned_minutes" >= 0),
	CONSTRAINT "chk_paa_quantity_positive" CHECK ("quantity" is null or "quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "project_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"assignment_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"minutes" integer NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_pal_minutes_range" CHECK ("minutes" > 0 and "minutes" <= 1440)
);
--> statement-breakpoint
CREATE INDEX "idx_paa_project" ON "project_activity_assignments" ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_paa_assignee" ON "project_activity_assignments" ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_pal_assignment" ON "project_activity_logs" ("assignment_id","log_date");--> statement-breakpoint
CREATE INDEX "idx_pal_project_date" ON "project_activity_logs" ("project_id","log_date");--> statement-breakpoint
ALTER TABLE "project_activity_assignments" ADD CONSTRAINT "project_activity_assignments_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_activity_assignments" ADD CONSTRAINT "project_activity_assignments_discipline_id_disciplines_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_activity_assignments" ADD CONSTRAINT "project_activity_assignments_XRDppOA7k2v1_fkey" FOREIGN KEY ("activity_id") REFERENCES "discipline_activities"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_activity_assignments" ADD CONSTRAINT "project_activity_assignments_yMDtxbdQC6lP_fkey" FOREIGN KEY ("sub_activity_id") REFERENCES "discipline_sub_activities"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_activity_assignments" ADD CONSTRAINT "project_activity_assignments_assignee_id_employees_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_activity_assignments" ADD CONSTRAINT "project_activity_assignments_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_activity_logs" ADD CONSTRAINT "project_activity_logs_0RP0ok46rGrE_fkey" FOREIGN KEY ("assignment_id") REFERENCES "project_activity_assignments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_activity_logs" ADD CONSTRAINT "project_activity_logs_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_activity_logs" ADD CONSTRAINT "project_activity_logs_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;