/*
  Warnings:

  - You are about to drop the column `VoucherHeaderSid` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `VoucherTypeMasterSid` on the `BookingRates` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "BookingRates" DROP CONSTRAINT "BookingRates_VoucherHeaderSid_fkey";

-- DropForeignKey
ALTER TABLE "BookingRates" DROP CONSTRAINT "BookingRates_VoucherTypeMasterSid_fkey";

-- AlterTable
ALTER TABLE "BookingRates" DROP COLUMN "VoucherHeaderSid",
DROP COLUMN "VoucherTypeMasterSid",
ADD COLUMN     "CostVoucherHeaderSid" INTEGER,
ADD COLUMN     "CostVoucherTypeMasterSid" INTEGER,
ADD COLUMN     "RevenueVoucherHeaderSid" INTEGER,
ADD COLUMN     "RevenueVoucherTypeMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "CurrencyMaster" ADD COLUMN     "CountryMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "CustomerMaster" ADD COLUMN     "AirlineCode" TEXT,
ADD COLUMN     "AirlineNumber" TEXT;

-- AlterTable
ALTER TABLE "QuoteRoute" ALTER COLUMN "CarrierName" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_AgentMasterSid_fkey" FOREIGN KEY ("AgentMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CostVoucherHeaderSid_fkey" FOREIGN KEY ("CostVoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CostVoucherTypeMasterSid_fkey" FOREIGN KEY ("CostVoucherTypeMasterSid") REFERENCES "VoucherTypeMaster"("VoucherTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_RevenueVoucherHeaderSid_fkey" FOREIGN KEY ("RevenueVoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_RevenueVoucherTypeMasterSid_fkey" FOREIGN KEY ("RevenueVoucherTypeMasterSid") REFERENCES "VoucherTypeMaster"("VoucherTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
