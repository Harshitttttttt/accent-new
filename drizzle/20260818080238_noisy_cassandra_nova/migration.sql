CREATE TYPE "crm_activity_tone" AS ENUM('success', 'warning', 'info', 'danger');--> statement-breakpoint
CREATE TYPE "crm_employee_status" AS ENUM('active', 'on-leave', 'inactive');--> statement-breakpoint
CREATE TYPE "crm_project_status" AS ENUM('active', 'at-risk', 'completed');--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" varchar(80) PRIMARY KEY,
	"title" varchar(200) NOT NULL,
	"detail" text NOT NULL,
	"tone" "crm_activity_tone" DEFAULT 'info'::"crm_activity_tone" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_employees" (
	"id" varchar(80) PRIMARY KEY,
	"name" varchar(120) NOT NULL,
	"status" "crm_employee_status" DEFAULT 'active'::"crm_employee_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_projects" (
	"id" varchar(80) PRIMARY KEY,
	"name" varchar(160) NOT NULL,
	"status" "crm_project_status" DEFAULT 'active'::"crm_project_status" NOT NULL,
	"owner" varchar(120) NOT NULL
);
