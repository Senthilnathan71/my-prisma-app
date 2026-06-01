-- DropForeignKey
ALTER TABLE "VoucherTDS" DROP CONSTRAINT "VoucherTDS_VoucherDetailSid_fkey";

-- AlterTable
ALTER TABLE "VoucherTDS" ADD COLUMN     "TDSPartyAmount" DECIMAL(15,3),
ALTER COLUMN "VoucherDetailSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "VoucherTDS" ADD CONSTRAINT "VoucherTDS_VoucherDetailSid_fkey" FOREIGN KEY ("VoucherDetailSid") REFERENCES "VoucherDetail"("VoucherDetailSid") ON DELETE SET NULL ON UPDATE CASCADE;
