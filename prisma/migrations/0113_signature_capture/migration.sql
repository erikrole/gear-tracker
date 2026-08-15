-- Signature capture uses a dedicated external-roster domain. It deliberately
-- does not reuse StudentSportAssignment, which represents internal users.

CREATE TYPE "SignatureCollectionStatus" AS ENUM ('OPEN', 'ARCHIVED');
CREATE TYPE "SignatureSnapshotStatus" AS ENUM ('PREVIEW', 'APPLIED');
CREATE TYPE "SignatureMemberGroup" AS ENUM ('PLAYER', 'COACHING_STAFF', 'SUPPORT_STAFF');
CREATE TYPE "SignatureArtifactState" AS ENUM ('READY', 'PENDING_DELETE', 'DELETED', 'FAILED');
CREATE TYPE "SignatureSaveStatus" AS ENUM ('UPLOADING', 'FINALIZING', 'COMMITTED', 'FAILED');

CREATE TABLE "signature_collections" (
    "id" TEXT NOT NULL,
    "sport_code" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "status" "SignatureCollectionStatus" NOT NULL DEFAULT 'OPEN',
    "collection_version" INTEGER NOT NULL DEFAULT 1,
    "pen_settings" JSONB NOT NULL,
    "settings_version" INTEGER NOT NULL DEFAULT 1,
    "first_capture_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "signature_roster_snapshots" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "status" "SignatureSnapshotStatus" NOT NULL DEFAULT 'PREVIEW',
    "source_key" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "parser_version" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "candidate_count" INTEGER NOT NULL,
    "entries" JSONB NOT NULL,
    "applied_at" TIMESTAMP(3),
    "applied_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_roster_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "signature_members" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "source_snapshot_id" TEXT NOT NULL,
    "source_external_id" TEXT NOT NULL,
    "source_profile_url" TEXT,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "jersey_number" INTEGER,
    "role_group" "SignatureMemberGroup" NOT NULL,
    "title" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "linked_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "signature_captures" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "capture_version" INTEGER NOT NULL DEFAULT 0,
    "settings_version" INTEGER NOT NULL DEFAULT 1,
    "current_revision_id" TEXT,
    "captured_at" TIMESTAMP(3),
    "captured_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_captures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "signature_artifact_revisions" (
    "id" TEXT NOT NULL,
    "capture_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "state" "SignatureArtifactState" NOT NULL DEFAULT 'PENDING_DELETE',
    "png_path" TEXT NOT NULL,
    "svg_path" TEXT NOT NULL,
    "png_hash" TEXT NOT NULL,
    "svg_hash" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "crop_bounds" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMP(3),
    "replaced_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "signature_artifact_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "signature_save_operations" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "capture_id" TEXT NOT NULL,
    "expected_capture_version" INTEGER NOT NULL,
    "settings_version" INTEGER NOT NULL,
    "status" "SignatureSaveStatus" NOT NULL DEFAULT 'UPLOADING',
    "revision_id" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "committed_at" TIMESTAMP(3),

    CONSTRAINT "signature_save_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signature_collections_sport_code_season_key" ON "signature_collections"("sport_code", "season");
CREATE INDEX "signature_collections_status_updated_at_idx" ON "signature_collections"("status", "updated_at");
CREATE INDEX "signature_collections_sport_code_season_idx" ON "signature_collections"("sport_code", "season");

CREATE UNIQUE INDEX "signature_roster_snapshots_collection_id_source_hash_key" ON "signature_roster_snapshots"("collection_id", "source_hash");
CREATE INDEX "signature_roster_snapshots_collection_id_created_at_idx" ON "signature_roster_snapshots"("collection_id", "created_at");
CREATE INDEX "signature_roster_snapshots_collection_id_status_idx" ON "signature_roster_snapshots"("collection_id", "status");

CREATE UNIQUE INDEX "signature_members_collection_id_source_external_id_key" ON "signature_members"("collection_id", "source_external_id");
CREATE INDEX "signature_members_collection_id_active_required_idx" ON "signature_members"("collection_id", "active", "required");
CREATE INDEX "signature_members_collection_id_role_group_active_idx" ON "signature_members"("collection_id", "role_group", "active");
CREATE INDEX "signature_members_linked_user_id_idx" ON "signature_members"("linked_user_id");

CREATE UNIQUE INDEX "signature_captures_member_id_key" ON "signature_captures"("member_id");
CREATE UNIQUE INDEX "signature_captures_current_revision_id_key" ON "signature_captures"("current_revision_id");
CREATE INDEX "signature_captures_collection_id_updated_at_idx" ON "signature_captures"("collection_id", "updated_at");
CREATE INDEX "signature_captures_collection_id_capture_version_idx" ON "signature_captures"("collection_id", "capture_version");

CREATE UNIQUE INDEX "signature_artifact_revisions_capture_id_revision_key" ON "signature_artifact_revisions"("capture_id", "revision");
CREATE INDEX "signature_artifact_revisions_state_created_at_idx" ON "signature_artifact_revisions"("state", "created_at");
CREATE INDEX "signature_artifact_revisions_capture_id_state_idx" ON "signature_artifact_revisions"("capture_id", "state");

CREATE UNIQUE INDEX "signature_save_operations_request_id_key" ON "signature_save_operations"("request_id");
CREATE INDEX "signature_save_operations_collection_id_member_id_created_at_idx" ON "signature_save_operations"("collection_id", "member_id", "created_at");
CREATE INDEX "signature_save_operations_status_updated_at_idx" ON "signature_save_operations"("status", "updated_at");
CREATE INDEX "signature_save_operations_revision_id_idx" ON "signature_save_operations"("revision_id");

ALTER TABLE "signature_collections" ADD CONSTRAINT "signature_collections_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signature_collections" ADD CONSTRAINT "signature_collections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signature_collections" ADD CONSTRAINT "signature_collections_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "signature_roster_snapshots" ADD CONSTRAINT "signature_roster_snapshots_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "signature_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_roster_snapshots" ADD CONSTRAINT "signature_roster_snapshots_applied_by_id_fkey" FOREIGN KEY ("applied_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "signature_members" ADD CONSTRAINT "signature_members_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "signature_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_members" ADD CONSTRAINT "signature_members_source_snapshot_id_fkey" FOREIGN KEY ("source_snapshot_id") REFERENCES "signature_roster_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signature_members" ADD CONSTRAINT "signature_members_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "signature_captures" ADD CONSTRAINT "signature_captures_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "signature_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_captures" ADD CONSTRAINT "signature_captures_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "signature_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_captures" ADD CONSTRAINT "signature_captures_captured_by_id_fkey" FOREIGN KEY ("captured_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signature_captures" ADD CONSTRAINT "signature_captures_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "signature_artifact_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "signature_artifact_revisions" ADD CONSTRAINT "signature_artifact_revisions_capture_id_fkey" FOREIGN KEY ("capture_id") REFERENCES "signature_captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signature_save_operations" ADD CONSTRAINT "signature_save_operations_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "signature_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_save_operations" ADD CONSTRAINT "signature_save_operations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "signature_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_save_operations" ADD CONSTRAINT "signature_save_operations_capture_id_fkey" FOREIGN KEY ("capture_id") REFERENCES "signature_captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_save_operations" ADD CONSTRAINT "signature_save_operations_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "signature_artifact_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signature_save_operations" ADD CONSTRAINT "signature_save_operations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
