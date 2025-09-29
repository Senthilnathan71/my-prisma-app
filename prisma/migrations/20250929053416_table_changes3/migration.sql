/*
  Warnings:

  - You are about to drop the column `VoucherHeaderSid` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `VoucherTypeSid` on the `CostRevenueCharges` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CostRevenueCharges" DROP COLUMN "VoucherHeaderSid",
DROP COLUMN "VoucherTypeSid",
ADD COLUMN     "CostVoucherHeaderSid" INTEGER,
ADD COLUMN     "CostVoucherTypeMasterSid" INTEGER,
ADD COLUMN     "RevenueVoucherHeaderSid" INTEGER,
ADD COLUMN     "RevenueVoucherTypeMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CostVoucherHeaderSid_fkey" FOREIGN KEY ("CostVoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CostVoucherTypeMasterSid_fkey" FOREIGN KEY ("CostVoucherTypeMasterSid") REFERENCES "VoucherTypeMaster"("VoucherTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_RevenueVoucherHeaderSid_fkey" FOREIGN KEY ("RevenueVoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_RevenueVoucherTypeMasterSid_fkey" FOREIGN KEY ("RevenueVoucherTypeMasterSid") REFERENCES "VoucherTypeMaster"("VoucherTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
