/*
  Warnings:

  - You are about to alter the column `DefaultClause` on the `BLClauseMaster` table. The data in that column could be lost. The data in that column will be cast from `Decimal(3,0)` to `Char(1)`.

*/
-- AlterTable
ALTER TABLE "BLClauseMaster" ALTER COLUMN "DefaultClause" SET DEFAULT 'N',
ALTER COLUMN "DefaultClause" SET DATA TYPE CHAR(1);
