-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "ChargeMaster" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
