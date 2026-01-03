-- AlterTable
ALTER TABLE "ChargeTaxMaster" ALTER COLUMN "TaxRate" SET DATA TYPE DECIMAL(6,3);

-- AlterTable
ALTER TABLE "VoucherTypeMaster" ADD COLUMN     "MenuMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "VoucherTypeMaster" ADD CONSTRAINT "VoucherTypeMaster_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
