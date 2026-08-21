CREATE TABLE "discipline_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(50) NOT NULL UNIQUE,
	"name" varchar(150) NOT NULL,
	"description" text,
	"discipline_id" uuid NOT NULL,
	"unit" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_discipline_activities_discipline_code" UNIQUE("discipline_id","code")
);
--> statement-breakpoint
CREATE TABLE "discipline_sub_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(50) NOT NULL UNIQUE,
	"name" varchar(150) NOT NULL,
	"description" text,
	"activity_id" uuid NOT NULL,
	"unit" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_discipline_sub_activities_activity_code" UNIQUE("activity_id","code")
);
--> statement-breakpoint
CREATE TABLE "disciplines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(50) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_discipline_activities_code" ON "discipline_activities" ("code");--> statement-breakpoint
CREATE INDEX "idx_discipline_activities_discipline" ON "discipline_activities" ("discipline_id");--> statement-breakpoint
CREATE INDEX "idx_discipline_activities_active" ON "discipline_activities" ("is_active");--> statement-breakpoint
CREATE INDEX "idx_discipline_sub_activities_code" ON "discipline_sub_activities" ("code");--> statement-breakpoint
CREATE INDEX "idx_discipline_sub_activities_activity" ON "discipline_sub_activities" ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_discipline_sub_activities_active" ON "discipline_sub_activities" ("is_active");--> statement-breakpoint
CREATE INDEX "idx_disciplines_code" ON "disciplines" ("code");--> statement-breakpoint
CREATE INDEX "idx_disciplines_name" ON "disciplines" ("name");--> statement-breakpoint
CREATE INDEX "idx_disciplines_active" ON "disciplines" ("is_active");--> statement-breakpoint
ALTER TABLE "discipline_activities" ADD CONSTRAINT "discipline_activities_discipline_id_disciplines_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "discipline_sub_activities" ADD CONSTRAINT "discipline_sub_activities_qqmFooqRX4SK_fkey" FOREIGN KEY ("activity_id") REFERENCES "discipline_activities"("id") ON DELETE CASCADE;