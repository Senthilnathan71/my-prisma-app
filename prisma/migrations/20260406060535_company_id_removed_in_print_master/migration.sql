/*
  Warnings:

  - You are about to drop the column `CompanyMasterSid` on the `PrintMaster` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PrintMaster" DROP CONSTRAINT "PrintMaster_CompanyMasterSid_fkey";

-- DropIndex
DROP INDEX "PrintMaster_CompanyMasterSid_MenuMasterSid_Name_Status_idx";

-- DropIndex
DROP INDEX "PrintMaster_CompanyMasterSid_PrintMail_idx";

-- AlterTable
ALTER TABLE "PrintMaster" DROP COLUMN "CompanyMasterSid";

-- AlterTable
ALTER TABLE "VoucherMatchingHeader" ALTER COLUMN "UpdatedOn" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PrintMaster_MenuMasterSid_Name_Status_idx" ON "PrintMaster"("MenuMasterSid", "Name", "Status");

-- CreateIndex
CREATE INDEX "PrintMaster_PrintMail_idx" ON "PrintMaster"("PrintMail");

-- CreateIndex
CREATE INDEX "YearMaster_CompanyMasterSid_status_idx" ON "YearMaster"("CompanyMasterSid", "status");

-- CreateIndex
CREATE INDEX "YearMaster_CompanyMasterSid_CurrentYear_idx" ON "YearMaster"("CompanyMasterSid", "CurrentYear");

-- CreateIndex
CREATE INDEX "YearMaster_CompanyMasterSid_StartDate_EndDate_idx" ON "YearMaster"("CompanyMasterSid", "StartDate", "EndDate");
