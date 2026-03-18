-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "shift_assignment_id" TEXT;

-- CreateIndex
CREATE INDEX "bookings_shift_assignment_id_idx" ON "bookings"("shift_assignment_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shift_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
