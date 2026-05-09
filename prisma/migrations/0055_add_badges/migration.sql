-- CreateEnum
CREATE TYPE "BadgeCategory" AS ENUM ('CHECKOUT', 'ON_TIME', 'SCAN', 'SHIFT', 'TRADE', 'STREAK', 'MILESTONE');

-- CreateEnum
CREATE TYPE "BadgeKind" AS ENUM ('COUNT', 'STREAK', 'RULE');

-- CreateEnum
CREATE TYPE "BadgeSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "BadgeStreakType" AS ENUM ('ON_TIME_RETURN', 'SCAN_CLEAN', 'SHIFT_ATTENDANCE');

-- CreateTable
CREATE TABLE "badge_definitions" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "category" "BadgeCategory" NOT NULL,
  "kind" "BadgeKind" NOT NULL,
  "trigger" TEXT NOT NULL,
  "threshold" INTEGER,
  "rule_key" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_badges" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "definition_id" TEXT NOT NULL,
  "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "BadgeSource" NOT NULL DEFAULT 'AUTO',
  "awarded_by_id" TEXT,
  "note" TEXT,

  CONSTRAINT "student_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_streaks" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "streak_type" "BadgeStreakType" NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  "longest" INTEGER NOT NULL DEFAULT 0,
  "last_event_at" TIMESTAMP(3),
  "last_source_key" TEXT,

  CONSTRAINT "badge_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_definitions_key_key" ON "badge_definitions"("key");

-- CreateIndex
CREATE INDEX "badge_definitions_active_sort_order_idx" ON "badge_definitions"("active", "sort_order");

-- CreateIndex
CREATE INDEX "badge_definitions_category_sort_order_idx" ON "badge_definitions"("category", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "student_badges_user_id_definition_id_key" ON "student_badges"("user_id", "definition_id");

-- CreateIndex
CREATE INDEX "student_badges_user_id_awarded_at_idx" ON "student_badges"("user_id", "awarded_at" DESC);

-- CreateIndex
CREATE INDEX "student_badges_definition_id_awarded_at_idx" ON "student_badges"("definition_id", "awarded_at" DESC);

-- CreateIndex
CREATE INDEX "student_badges_awarded_by_id_idx" ON "student_badges"("awarded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "badge_streaks_user_id_streak_type_key" ON "badge_streaks"("user_id", "streak_type");

-- CreateIndex
CREATE INDEX "badge_streaks_user_id_idx" ON "badge_streaks"("user_id");

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "badge_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_awarded_by_id_fkey" FOREIGN KEY ("awarded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_streaks" ADD CONSTRAINT "badge_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
