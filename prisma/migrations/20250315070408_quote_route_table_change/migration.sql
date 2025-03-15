-- AlterTable
ALTER TABLE "QuoteRoute" ADD COLUMN     "CarrierMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "QuoteRoute" ADD CONSTRAINT "QuoteRoute_CarrierMasterSid_fkey" FOREIGN KEY ("CarrierMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
