-- Drop unused `order` column from guides; manual reorder UI was never built and
-- list ordering uses updatedAt only. See tasks/audit-guides-web.md (P2 #1).
ALTER TABLE "guides" DROP COLUMN "order";
