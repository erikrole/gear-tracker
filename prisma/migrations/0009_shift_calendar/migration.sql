-- CreateEnum
CREATE TYPE "ShiftArea" AS ENUM ('VIDEO', 'PHOTO', 'GRAPHICS', 'COMMS');

-- CreateEnum
CREATE TYPE "ShiftWorkerType" AS ENUM ('FT', 'ST');

-- CreateEnum
CREATE TYPE "ShiftAssignmentStatus" AS ENUM ('DIRECT_ASSIGNED', 'REQUESTED', 'APPROVED', 'DECLINED', 'SWAPPED');

-- CreateEnum
CREATE TYPE "ShiftTradeStatus" AS ENUM ('OPEN', 'CLAIMED', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone" TEXT,
ADD COLUMN "primary_area" "ShiftArea";

-- CreateTable
CREATE TABLE "sport_configs" (
    "id" TEXT NOT NULL,
    "sport_code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sport_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_shift_configs" (
    "id" TEXT NOT NULL,
    "sport_config_id" TEXT NOT NULL,
    "area" "ShiftArea" NOT NULL,
    "home_count" INTEGER NOT NULL DEFAULT 1,
    "away_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sport_shift_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_groups" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "is_premier" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "generated_at" TIMESTAMP(3),
    "manually_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "shift_group_id" TEXT NOT NULL,
    "area" "ShiftArea" NOT NULL,
    "worker_type" "ShiftWorkerType" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ShiftAssignmentStatus" NOT NULL,
    "assigned_by" TEXT,
    "swap_from_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_sport_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sport_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_sport_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_area_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "area" "ShiftArea" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_area_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_trades" (
    "id" TEXT NOT NULL,
    "shift_assignment_id" TEXT NOT NULL,
    "posted_by_user_id" TEXT NOT NULL,
    "claimed_by_user_id" TEXT,
    "status" "ShiftTradeStatus" NOT NULL DEFAULT 'OPEN',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sport_configs_sport_code_key" ON "sport_configs"("sport_code");

-- CreateIndex
CREATE UNIQUE INDEX "sport_shift_configs_sport_config_id_area_key" ON "sport_shift_configs"("sport_config_id", "area");

-- CreateIndex
CREATE UNIQUE INDEX "shift_groups_event_id_key" ON "shift_groups"("event_id");

-- CreateIndex
CREATE INDEX "shifts_shift_group_id_idx" ON "shifts"("shift_group_id");

-- CreateIndex
CREATE INDEX "shifts_area_worker_type_idx" ON "shifts"("area", "worker_type");

-- CreateIndex
CREATE INDEX "shifts_starts_at_ends_at_idx" ON "shifts"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "shift_assignments_shift_id_status_idx" ON "shift_assignments"("shift_id", "status");

-- CreateIndex
CREATE INDEX "shift_assignments_user_id_status_idx" ON "shift_assignments"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_sport_assignments_user_id_sport_code_key" ON "student_sport_assignments"("user_id", "sport_code");

-- CreateIndex
CREATE INDEX "student_sport_assignments_sport_code_idx" ON "student_sport_assignments"("sport_code");

-- CreateIndex
CREATE UNIQUE INDEX "student_area_assignments_user_id_area_key" ON "student_area_assignments"("user_id", "area");

-- CreateIndex
CREATE INDEX "student_area_assignments_area_idx" ON "student_area_assignments"("area");

-- CreateIndex
CREATE INDEX "shift_trades_status_idx" ON "shift_trades"("status");

-- CreateIndex
CREATE INDEX "shift_trades_posted_by_user_id_idx" ON "shift_trades"("posted_by_user_id");

-- CreateIndex
CREATE INDEX "shift_trades_claimed_by_user_id_idx" ON "shift_trades"("claimed_by_user_id");

-- AddForeignKey
ALTER TABLE "sport_shift_configs" ADD CONSTRAINT "sport_shift_configs_sport_config_id_fkey" FOREIGN KEY ("sport_config_id") REFERENCES "sport_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_groups" ADD CONSTRAINT "shift_groups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_shift_group_id_fkey" FOREIGN KEY ("shift_group_id") REFERENCES "shift_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_swap_from_id_fkey" FOREIGN KEY ("swap_from_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_sport_assignments" ADD CONSTRAINT "student_sport_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_area_assignments" ADD CONSTRAINT "student_area_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_shift_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_trades" ADD CONSTRAINT "shift_trades_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
