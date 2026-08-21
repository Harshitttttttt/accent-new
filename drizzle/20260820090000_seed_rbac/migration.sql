-- Seed RBAC roles, permissions and role-permission matrix (idempotent)
-- Roles
INSERT INTO "roles" ("code", "name", "description") VALUES ('admin', 'Administrator', 'Full system, data, and user management access') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "roles" ("code", "name", "description") VALUES ('project_manager', 'Project Manager', 'Manage client delivery, schedules, and team allocation') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "roles" ("code", "name", "description") VALUES ('accounts', 'Accounts & Finance', 'Manage proposals, invoices, billing, and project budgets') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "roles" ("code", "name", "description") VALUES ('hr', 'Human Resources', 'Manage staff profiles, capacity, and organizational data') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "roles" ("code", "name", "description") VALUES ('engineer', 'Engineer', 'Execute sprint tasks and project operations') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- Permissions
INSERT INTO "permissions" ("code", "description") VALUES ('users.manage', 'Create, update, deactivate, and delete user accounts and role assignments') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('permissions.manage', 'Create, update, and delete system permissions and RBAC role bindings') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('audit.view', 'Inspect system-wide audit logs and administrative activity history') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('projects.read', 'View project registers, progress, schedules, and deliverables') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('projects.write', 'Create and update projects, milestones, and team assignments') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('leads.read', 'View sales pipeline leads, valuations, and conversion stages') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('leads.write', 'Create leads, move stages, and modify deal parameters') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('proposals.read', 'View commercial proposals, cost estimates, and profit margins') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('proposals.write', 'Draft, submit, and manage commercial project proposals') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('finance.read', 'View accounts receivable, invoicing timelines, and financial summaries') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('finance.write', 'Issue invoices, record payments, and approve company expenses') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('employees.read', 'View staff directory, technical skills, and utilization statistics') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('employees.write', 'Add and edit employee profiles, departments, and payroll records') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("code", "description") VALUES ('reports.view', 'Access the reporting center and export operational intelligence') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- Role-Permission matrix (only for roles with zero bindings, to preserve custom edits)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code='admin' AND p.code IN ('users.manage','permissions.manage','audit.view','projects.read','projects.write','leads.read','leads.write','proposals.read','proposals.write','finance.read','finance.write','employees.read','employees.write','reports.view')
AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code='project_manager' AND p.code IN ('projects.read','projects.write','leads.read','proposals.read','proposals.write','employees.read','reports.view')
AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code='accounts' AND p.code IN ('finance.read','finance.write','proposals.read','projects.read','reports.view')
AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code='hr' AND p.code IN ('employees.read','employees.write','reports.view')
AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code='engineer' AND p.code IN ('projects.read','reports.view')
AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id)
ON CONFLICT DO NOTHING;
