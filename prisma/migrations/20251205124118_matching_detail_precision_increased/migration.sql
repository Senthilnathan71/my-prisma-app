-- DropForeignKey
ALTER TABLE "NetworkMaster" DROP CONSTRAINT "NetworkMaster_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "MatchingDetail" ALTER COLUMN "MatchingExRate" SET DATA TYPE DECIMAL(7,3);

-- AlterTable
ALTER TABLE "NetworkMaster" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "NetworkMaster" ADD CONSTRAINT "NetworkMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
