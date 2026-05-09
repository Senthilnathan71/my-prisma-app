-- AlterTable
ALTER TABLE "PaymentRequestDetail" ADD COLUMN     "BookingRatesSid" INTEGER,
ADD COLUMN     "CostRevenueChargesSid" INTEGER;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_BookingRatesSid_fkey" FOREIGN KEY ("BookingRatesSid") REFERENCES "BookingRates"("BookingRatesSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_CostRevenueChargesSid_fkey" FOREIGN KEY ("CostRevenueChargesSid") REFERENCES "CostRevenueCharges"("CostRevenueChargesSid") ON DELETE SET NULL ON UPDATE CASCADE;
