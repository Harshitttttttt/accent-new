CREATE TYPE "milestone_status" AS ENUM('pending', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "project_lifecycle" AS ENUM('planning', 'in_progress', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "risk_severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "risk_status" AS ENUM('open', 'mitigated', 'closed');