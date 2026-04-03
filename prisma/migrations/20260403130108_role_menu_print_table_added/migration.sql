/*
  Warnings:

  - You are about to drop the column `RoleMenuHeaderSid` on the `PrintMaster` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PrintMaster" DROP CONSTRAINT "PrintMaster_RoleMenuHeaderSid_fkey";

-- DropIndex
DROP INDEX "PrintMaster_CompanyMasterSid_RoleMenuHeaderSid_MenuMasterSi_idx";

-- AlterTable
ALTER TABLE "BookingRates" ADD COLUMN     "PaymentRequestSid" INTEGER;

-- AlterTable
ALTER TABLE "PrintMaster" DROP COLUMN "RoleMenuHeaderSid";

-- CreateTable
CREATE TABLE "RoleMenuPrint" (
    "RoleMenuPrintSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "RoleMenuHeaderSid" INTEGER NOT NULL,
    "RoleMenuDetailSid" INTEGER NOT NULL,
    "PrintMasterSid" INTEGER NOT NULL,
    "GiveAccess" CHAR(1) DEFAULT 'N',
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedOn" TIMESTAMPTZ(6),
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "RoleMenuPrint_pkey" PRIMARY KEY ("RoleMenuPrintSid")
);

-- CreateIndex
CREATE INDEX "RoleMenuPrint_CompanyMasterSid_RoleMenuHeaderSid_RoleMenuDe_idx" ON "RoleMenuPrint"("CompanyMasterSid", "RoleMenuHeaderSid", "RoleMenuDetailSid", "PrintMasterSid", "Status");

-- CreateIndex
CREATE INDEX "RoleMenuPrint_CompanyMasterSid_PrintMasterSid_idx" ON "RoleMenuPrint"("CompanyMasterSid", "PrintMasterSid");

-- CreateIndex
CREATE INDEX "AttachDocumentGroup_MenuMasterSid_DocumentSid_idx" ON "AttachDocumentGroup"("MenuMasterSid", "DocumentSid");

-- CreateIndex
CREATE INDEX "MenuPermission_MenuMasterSid_idx" ON "MenuPermission"("MenuMasterSid");

-- CreateIndex
CREATE INDEX "PreCustomerMaster_CompanyMasterSid_BranchMasterSid_idx" ON "PreCustomerMaster"("CompanyMasterSid", "BranchMasterSid");

-- CreateIndex
CREATE INDEX "PreCustomerMaster_CompanyMasterSid_preCustomerName_idx" ON "PreCustomerMaster"("CompanyMasterSid", "preCustomerName");

-- CreateIndex
CREATE INDEX "PrintMaster_CompanyMasterSid_MenuMasterSid_Name_Status_idx" ON "PrintMaster"("CompanyMasterSid", "MenuMasterSid", "Name", "Status");

-- CreateIndex
CREATE INDEX "UserMaster_userEmail_idx" ON "UserMaster"("userEmail");

-- CreateIndex
CREATE INDEX "UserMaster_isSalesperson_idx" ON "UserMaster"("isSalesperson");

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_PaymentRequestSid_fkey" FOREIGN KEY ("PaymentRequestSid") REFERENCES "PaymentRequest"("PaymentRequestSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuPrint" ADD CONSTRAINT "RoleMenuPrint_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuPrint" ADD CONSTRAINT "RoleMenuPrint_RoleMenuHeaderSid_fkey" FOREIGN KEY ("RoleMenuHeaderSid") REFERENCES "RoleMenuHeader"("RoleMenuHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuPrint" ADD CONSTRAINT "RoleMenuPrint_RoleMenuDetailSid_fkey" FOREIGN KEY ("RoleMenuDetailSid") REFERENCES "RoleMenuDetail"("RoleMenuDetailSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuPrint" ADD CONSTRAINT "RoleMenuPrint_PrintMasterSid_fkey" FOREIGN KEY ("PrintMasterSid") REFERENCES "PrintMaster"("PrintMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
