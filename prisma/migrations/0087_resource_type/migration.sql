CREATE TYPE "ResourceType" AS ENUM (
  'CONTACTS',
  'BUILDING_NUMBERS',
  'MEDIA_DRIVE',
  'SERVER_PATHS',
  'SOP',
  'HOW_TO',
  'TROUBLESHOOTING',
  'ACCOUNT_NOTE',
  'EVENT_OPS',
  'GENERAL'
);

ALTER TABLE "resources"
  ADD COLUMN "type" "ResourceType" NOT NULL DEFAULT 'GENERAL';

UPDATE "resources"
SET "type" = CASE
  WHEN lower(trim("category")) IN ('contacts', 'contact', 'team contacts') THEN 'CONTACTS'::"ResourceType"
  WHEN lower(trim("category")) IN ('building numbers', 'building number', 'buildings') THEN 'BUILDING_NUMBERS'::"ResourceType"
  WHEN lower(trim("category")) IN ('media drive', 'media drives') THEN 'MEDIA_DRIVE'::"ResourceType"
  WHEN lower(trim("category")) IN ('server paths', 'server path', 'paths') THEN 'SERVER_PATHS'::"ResourceType"
  WHEN lower(trim("category")) IN ('sops', 'sop', 'standard operating procedure', 'standard operating procedures') THEN 'SOP'::"ResourceType"
  WHEN lower(trim("category")) IN ('how-to', 'how to', 'how-to guides', 'how to guides') THEN 'HOW_TO'::"ResourceType"
  WHEN lower(trim("category")) IN ('troubleshooting', 'troubleshoot') THEN 'TROUBLESHOOTING'::"ResourceType"
  WHEN lower(trim("category")) IN ('accounts', 'account', 'account notes', 'account note') THEN 'ACCOUNT_NOTE'::"ResourceType"
  WHEN lower(trim("category")) IN ('event ops', 'event operations', 'event operation') THEN 'EVENT_OPS'::"ResourceType"
  ELSE 'GENERAL'::"ResourceType"
END;

CREATE INDEX "resources_type_idx" ON "resources"("type");
