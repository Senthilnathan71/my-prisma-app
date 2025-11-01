-- AlterTable
ALTER TABLE "CostRevenueCharges" ADD COLUMN     "BookingRateSid" INTEGER;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_BookingRateSid_fkey" FOREIGN KEY ("BookingRateSid") REFERENCES "BookingRates"("BookingRatesSid") ON DELETE SET NULL ON UPDATE CASCADE;
