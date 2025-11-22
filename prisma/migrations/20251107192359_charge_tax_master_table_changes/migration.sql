-- AlterTable
ALTER TABLE "ChargeTaxMaster" ADD COLUMN     "HSSACMasterSid" INTEGER,
ADD COLUMN     "TaxGroupSid" INTEGER;

-- AddForeignKey
ALTER TABLE "ChargeTaxMaster" ADD CONSTRAINT "ChargeTaxMaster_TaxGroupSid_fkey" FOREIGN KEY ("TaxGroupSid") REFERENCES "TaxGroup"("TaxGroupSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeTaxMaster" ADD CONSTRAINT "ChargeTaxMaster_HSSACMasterSid_fkey" FOREIGN KEY ("HSSACMasterSid") REFERENCES "HSSACMaster"("HSSACMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
