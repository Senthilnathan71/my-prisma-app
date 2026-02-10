-- AlterTable
ALTER TABLE "CustomerMaster" ADD COLUMN     "CurrencyMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "CustomerMaster" ADD CONSTRAINT "CustomerMaster_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
