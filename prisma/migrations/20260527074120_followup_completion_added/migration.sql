/*
  Warnings:

  - The `ExternalUser` column on the `Followup` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `InternalUser` column on the `Followup` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "AttachDocument" ALTER COLUMN "FollowupDate" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "Followup" ADD COLUMN     "MenuMasterSid" INTEGER,
ALTER COLUMN "FollowupDate" SET DATA TYPE TIMESTAMPTZ(6),
DROP COLUMN "ExternalUser",
ADD COLUMN     "ExternalUser" INTEGER,
DROP COLUMN "InternalUser",
ADD COLUMN     "InternalUser" INTEGER;

-- AlterTable
ALTER TABLE "MeetingFollowup" ADD COLUMN     "isCompleted" CHAR(1) DEFAULT 'N';

-- CreateIndex
CREATE INDEX "BranchMaster_status_idx" ON "BranchMaster"("status");

-- CreateIndex
CREATE INDEX "CustomerBranch_status_idx" ON "CustomerBranch"("status");

-- CreateIndex
CREATE INDEX "CustomerMaster_CompanyMasterSid_idx" ON "CustomerMaster"("CompanyMasterSid");

-- CreateIndex
CREATE INDEX "CustomerMaster_CustomerType_idx" ON "CustomerMaster"("CustomerType");

-- CreateIndex
CREATE INDEX "CustomerMaster_status_idx" ON "CustomerMaster"("status");

-- CreateIndex
CREATE INDEX "PortMaster_status_idx" ON "PortMaster"("status");

-- AddForeignKey
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_InternalUser_fkey" FOREIGN KEY ("InternalUser") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_ExternalUser_fkey" FOREIGN KEY ("ExternalUser") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
