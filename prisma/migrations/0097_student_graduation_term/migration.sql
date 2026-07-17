-- Add the academic term that pairs with the existing anticipated graduation year.
CREATE TYPE "GraduationTerm" AS ENUM ('WINTER', 'SPRING', 'SUMMER', 'FALL');

ALTER TABLE "users"
ADD COLUMN "graduation_term" "GraduationTerm";
