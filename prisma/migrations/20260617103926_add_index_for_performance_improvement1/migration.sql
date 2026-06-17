-- CreateIndex
CREATE INDEX "ChargeTaxMaster_chargeTaxMasterSid_idx" ON "ChargeTaxMaster"("chargeTaxMasterSid");

-- CreateIndex
CREATE INDEX "VoucherDetail_CostRevenueChargesSid_Status_idx" ON "VoucherDetail"("CostRevenueChargesSid", "Status");

-- CreateIndex
CREATE INDEX "VoucherDetail_BookingRatesSid_Status_idx" ON "VoucherDetail"("BookingRatesSid", "Status");

-- CreateIndex
CREATE INDEX "VoucherHeader_Status_idx" ON "VoucherHeader"("Status");
