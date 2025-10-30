/*
  Warnings:

  - You are about to alter the column `NoOfUnit` on the `BookingRates` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(7,3)`.
  - A unique constraint covering the columns `[VoucherTransactionSid]` on the table `VoucherDetail` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "VoucherTransaction" DROP CONSTRAINT "VoucherTransaction_VoucherDetailSid_fkey";

-- AlterTable
ALTER TABLE "BookingRates" ALTER COLUMN "CostExchangeRate" SET DATA TYPE DECIMAL(8,4),
ALTER COLUMN "CostNumberOfUnit" SET DATA TYPE DECIMAL(7,3),
ALTER COLUMN "RevenueExchangeRate" SET DATA TYPE DECIMAL(8,4),
ALTER COLUMN "RevenueNumberOfUnit" SET DATA TYPE DECIMAL(7,3),
ALTER COLUMN "NoOfUnit" SET DATA TYPE DECIMAL(7,3);

-- AlterTable
ALTER TABLE "CostRevenueCharges" ALTER COLUMN "CostExchangeRate" SET DATA TYPE DECIMAL(8,4),
ALTER COLUMN "CostNumberOfUnit" SET DATA TYPE DECIMAL(7,3),
ALTER COLUMN "RevenueExchangeRate" SET DATA TYPE DECIMAL(8,4),
ALTER COLUMN "RevenueNumberOfUnit" SET DATA TYPE DECIMAL(7,3);

-- AlterTable
ALTER TABLE "VoucherDetail" ADD COLUMN     "VoucherTransactionSid" INTEGER;

-- AlterTable
ALTER TABLE "VoucherOthers" ADD COLUMN     "BookingHeaderSid" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "VoucherDetail_VoucherTransactionSid_key" ON "VoucherDetail"("VoucherTransactionSid");

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_VoucherTransactionSid_fkey" FOREIGN KEY ("VoucherTransactionSid") REFERENCES "VoucherTransaction"("VoucherTransactionSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherOthers" ADD CONSTRAINT "VoucherOthers_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
