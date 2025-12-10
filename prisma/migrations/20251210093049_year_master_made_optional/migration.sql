-- DropForeignKey
ALTER TABLE "VoucherDetail" DROP CONSTRAINT "VoucherDetail_COAMasterSid_fkey";

-- AlterTable
ALTER TABLE "VoucherDetail" ALTER COLUMN "YearMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
