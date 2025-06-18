-- DropForeignKey
ALTER TABLE "MilestoneMaster" DROP CONSTRAINT "MilestoneMaster_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "MilestoneMaster" DROP CONSTRAINT "MilestoneMaster_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "MilestoneMaster" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL,
ALTER COLUMN "BranchMasterSid" DROP NOT NULL,
ALTER COLUMN "AutoCapture" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MilestoneMaster" ADD CONSTRAINT "MilestoneMaster_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneMaster" ADD CONSTRAINT "MilestoneMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
