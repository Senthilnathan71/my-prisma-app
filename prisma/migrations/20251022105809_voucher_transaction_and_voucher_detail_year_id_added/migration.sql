-- AlterTable
ALTER TABLE "VoucherDetail" ADD COLUMN     "YearMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "VoucherTransaction" ADD COLUMN     "YearMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_YearMasterSid_fkey" FOREIGN KEY ("YearMasterSid") REFERENCES "YearMaster"("YearMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_YearMasterSid_fkey" FOREIGN KEY ("YearMasterSid") REFERENCES "YearMaster"("YearMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
