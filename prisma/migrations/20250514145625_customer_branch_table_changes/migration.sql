-- DropForeignKey
ALTER TABLE "CustomerBranch" DROP CONSTRAINT "CustomerBranch_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "CustomerBranch" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CustomerBranch" ADD CONSTRAINT "CustomerBranch_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
