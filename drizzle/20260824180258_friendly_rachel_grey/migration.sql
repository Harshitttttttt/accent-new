CREATE TABLE "project_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_input_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"role" varchar(100) DEFAULT 'Engineer' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_project_members_project_employee" UNIQUE("project_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"due_date" date,
	"status" "milestone_status" DEFAULT 'pending'::"milestone_status" NOT NULL,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"description" varchar(1000) NOT NULL,
	"severity" "risk_severity" DEFAULT 'medium'::"risk_severity" NOT NULL,
	"mitigation" text,
	"status" "risk_status" DEFAULT 'open'::"risk_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_software" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"software_id" uuid,
	"name" varchar(255) NOT NULL,
	"notes" varchar(500),
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"from_status" "project_lifecycle",
	"to_status" "project_lifecycle" NOT NULL,
	"note" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_number" varchar(27) NOT NULL UNIQUE,
	"proposal_id" uuid,
	"lead_id" uuid,
	"company_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "project_lifecycle" DEFAULT 'planning'::"project_lifecycle" NOT NULL,
	"priority" "lead_priority" DEFAULT 'medium'::"lead_priority" NOT NULL,
	"contract_type" "proposal_contract_type" DEFAULT 'lumpsum'::"proposal_contract_type" NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"contract_value_paise" bigint,
	"estimated_cost_paise" bigint,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(20),
	"designation" varchar(100),
	"city" varchar(100),
	"site_location" varchar(255),
	"scope_of_work" text,
	"start_date" date,
	"end_date" date,
	"kickoff_meeting_date" date,
	"mode_of_delivery" varchar(100),
	"payment_terms" text,
	"other_terms" text,
	"notes" text,
	"project_manager_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_projects_progress_range" CHECK ("progress" between 0 and 100),
	CONSTRAINT "chk_projects_values_nonnegative" CHECK ("contract_value_paise" >= 0 and "estimated_cost_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX "idx_project_comments_project" ON "project_comments" ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_project_deliverables_project" ON "project_deliverables" ("project_id","position");--> statement-breakpoint
CREATE INDEX "idx_project_exclusions_project" ON "project_exclusions" ("project_id","position");--> statement-breakpoint
CREATE INDEX "idx_project_input_docs_project" ON "project_input_documents" ("project_id","position");--> statement-breakpoint
CREATE INDEX "idx_project_members_project" ON "project_members" ("project_id","position");--> statement-breakpoint
CREATE INDEX "idx_project_milestones_project" ON "project_milestones" ("project_id","position");--> statement-breakpoint
CREATE INDEX "idx_project_risks_project" ON "project_risks" ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_project_software_project" ON "project_software" ("project_id","position");--> statement-breakpoint
CREATE INDEX "idx_project_status_history_project" ON "project_status_history" ("project_id","changed_at");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" ("status");--> statement-breakpoint
CREATE INDEX "idx_projects_company" ON "projects" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_projects_proposal" ON "projects" ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_projects_pm" ON "projects" ("project_manager_id");--> statement-breakpoint
CREATE INDEX "idx_projects_active_created" ON "projects" ("created_at") WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_exclusions" ADD CONSTRAINT "project_exclusions_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_input_documents" ADD CONSTRAINT "project_input_documents_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_software" ADD CONSTRAINT "project_software_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_software" ADD CONSTRAINT "project_software_software_id_software_masters_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software_masters"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_changed_by_users_id_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_proposal_id_proposals_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_id_employees_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "employees"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;