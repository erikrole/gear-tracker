-- CreateEnum
CREATE TYPE "LicenseCodeStatus" AS ENUM ('AVAILABLE', 'CLAIMED', 'RETIRED');

-- CreateTable
CREATE TABLE "license_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "status" "LicenseCodeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "claimed_by_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "nag_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "license_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_code_claims" (
    "id" TEXT NOT NULL,
    "license_code_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "released_by_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "license_code_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "license_codes_code_key" ON "license_codes"("code");

-- CreateIndex
CREATE INDEX "license_codes_status_idx" ON "license_codes"("status");

-- CreateIndex
CREATE INDEX "license_codes_claimed_by_id_idx" ON "license_codes"("claimed_by_id");

-- CreateIndex: one active claim per user (partial unique index)
CREATE UNIQUE INDEX "license_code_one_active_per_user" ON "license_codes"("claimed_by_id") WHERE "status" = 'CLAIMED';

-- CreateIndex
CREATE INDEX "license_code_claims_user_id_released_at_idx" ON "license_code_claims"("user_id", "released_at");

-- CreateIndex
CREATE INDEX "license_code_claims_license_code_id_idx" ON "license_code_claims"("license_code_id");

-- AddForeignKey
ALTER TABLE "license_codes" ADD CONSTRAINT "license_codes_claimed_by_id_fkey" FOREIGN KEY ("claimed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_codes" ADD CONSTRAINT "license_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_code_claims" ADD CONSTRAINT "license_code_claims_license_code_id_fkey" FOREIGN KEY ("license_code_id") REFERENCES "license_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_code_claims" ADD CONSTRAINT "license_code_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
