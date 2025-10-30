-- AlterTable
ALTER TABLE "SubledgerMaster" ADD COLUMN     "CompanyMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "SubledgerMaster" ADD CONSTRAINT "SubledgerMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
