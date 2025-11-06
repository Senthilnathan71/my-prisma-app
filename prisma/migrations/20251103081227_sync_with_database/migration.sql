/*
  Warnings:

  - The primary key for the `VoucherHeader` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `EnquiryHeaderSid` on the `VoucherHeader` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "BookingRates" DROP CONSTRAINT "BookingRates_CostVoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "BookingRates" DROP CONSTRAINT "BookingRates_RevenueVoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "CostRevenueCharges" DROP CONSTRAINT "CostRevenueCharges_CostVoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "CostRevenueCharges" DROP CONSTRAINT "CostRevenueCharges_RevenueVoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherDetail" DROP CONSTRAINT "VoucherDetail_VoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherMatching" DROP CONSTRAINT "VoucherMatching_VoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherOthers" DROP CONSTRAINT "VoucherOthers_VoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherTDS" DROP CONSTRAINT "VoucherTDS_VoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherTransaction" DROP CONSTRAINT "VoucherTransaction_VoucherHeaderSid_fkey";

-- AlterTable
ALTER TABLE "VoucherHeader" DROP CONSTRAINT "VoucherHeader_pkey",
DROP COLUMN "EnquiryHeaderSid",
ADD COLUMN     "VoucherHeaderSid" SERIAL NOT NULL,
ADD CONSTRAINT "VoucherHeader_pkey" PRIMARY KEY ("VoucherHeaderSid");

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CostVoucherHeaderSid_fkey" FOREIGN KEY ("CostVoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_RevenueVoucherHeaderSid_fkey" FOREIGN KEY ("RevenueVoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CostVoucherHeaderSid_fkey" FOREIGN KEY ("CostVoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_RevenueVoucherHeaderSid_fkey" FOREIGN KEY ("RevenueVoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherOthers" ADD CONSTRAINT "VoucherOthers_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTDS" ADD CONSTRAINT "VoucherTDS_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatching" ADD CONSTRAINT "VoucherMatching_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
