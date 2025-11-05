-- AlterTable
ALTER TABLE "TaxMaster" ADD COLUMN     "CountryMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "VoucherHeader" ADD COLUMN     "PostStatus" CHAR(1) DEFAULT 'U';

-- AddForeignKey
ALTER TABLE "TaxMaster" ADD CONSTRAINT "TaxMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
