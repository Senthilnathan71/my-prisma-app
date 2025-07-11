/*
  Warnings:

  - The `LedgerLocation` column on the `COAMaster` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "COAMaster" ADD COLUMN     "Category" VARCHAR(100),
ADD COLUMN     "ReportType" VARCHAR(100),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "SubledgerName" DROP NOT NULL,
DROP COLUMN "LedgerLocation",
ADD COLUMN     "LedgerLocation" JSONB;
