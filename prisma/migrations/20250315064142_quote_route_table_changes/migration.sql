/*
  Warnings:

  - The `CompanyType` column on the `CustomerMaster` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CustomerMaster" DROP COLUMN "CompanyType",
ADD COLUMN     "CompanyType" JSONB;

-- AlterTable
ALTER TABLE "QuoteRoute" ADD COLUMN     "segmentType" VARCHAR(20);
