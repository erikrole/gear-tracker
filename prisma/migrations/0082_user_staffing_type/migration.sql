ALTER TABLE "users" ADD COLUMN "staffing_type" "ShiftWorkerType" NOT NULL DEFAULT 'ST';

UPDATE "users"
SET "staffing_type" = CASE
  WHEN "role" IN ('ADMIN', 'STAFF') THEN 'FT'::"ShiftWorkerType"
  ELSE 'ST'::"ShiftWorkerType"
END;
