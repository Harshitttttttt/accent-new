CREATE TYPE "employee_status" AS ENUM('active', 'notice_period', 'inactive', 'terminated');--> statement-breakpoint
CREATE TYPE "employment_type" AS ENUM('full_time', 'contract', 'intern', 'consultant');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(50) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(50) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"employee_code" varchar(50) NOT NULL UNIQUE,
	"user_id" uuid UNIQUE,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(20),
	"department_id" uuid,
	"designation_id" uuid,
	"manager_id" uuid,
	"employment_type" "employment_type" DEFAULT 'full_time'::"employment_type" NOT NULL,
	"status" "employee_status" DEFAULT 'active'::"employee_status" NOT NULL,
	"joining_date" date NOT NULL,
	"leaving_date" date,
	"skills" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "crm_employees";--> statement-breakpoint
CREATE INDEX "idx_employees_code" ON "employees" ("employee_code");--> statement-breakpoint
CREATE INDEX "idx_employees_user_id" ON "employees" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_employees_dept" ON "employees" ("department_id");--> statement-breakpoint
CREATE INDEX "idx_employees_designation" ON "employees" ("designation_id");--> statement-breakpoint
CREATE INDEX "idx_employees_manager" ON "employees" ("manager_id");--> statement-breakpoint
CREATE INDEX "idx_employees_status" ON "employees" ("status");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_designation_id_designations_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_employees_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL;--> statement-breakpoint
DROP TYPE "crm_employee_status";