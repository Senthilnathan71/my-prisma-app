-- AlterTable
ALTER TABLE "BookingRates" ADD COLUMN     "ChargeCOAMasterSid" INTEGER,
ADD COLUMN     "ChargeSubledgerMasterSid" INTEGER,
ADD COLUMN     "PartyCOAMasterSid" INTEGER,
ADD COLUMN     "PartySubledgerMasterSid" INTEGER,
ADD COLUMN     "VendorCOAMasterSid" INTEGER,
ADD COLUMN     "VendorSubledgerMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "BranchMaster" ALTER COLUMN "postalCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CostRevenueCharges" ADD COLUMN     "ChargeCOAMasterSid" INTEGER,
ADD COLUMN     "ChargeSubledgerMasterSid" INTEGER,
ADD COLUMN     "PartyCOAMasterSid" INTEGER,
ADD COLUMN     "PartySubledgerMasterSid" INTEGER,
ADD COLUMN     "VendorCOAMasterSid" INTEGER,
ADD COLUMN     "VendorSubledgerMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "QuoteRoute" ADD COLUMN     "FreightPPCC" VARCHAR(10) DEFAULT 'Prepaid';

-- AlterTable
ALTER TABLE "ShipmentMilestone" ALTER COLUMN "ShipmentNo" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "VoucherDetail" ADD COLUMN     "CostRevenueChargeSid" INTEGER;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_ChargeCOAMasterSid_fkey" FOREIGN KEY ("ChargeCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_ChargeSubledgerMasterSid_fkey" FOREIGN KEY ("ChargeSubledgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_PartyCOAMasterSid_fkey" FOREIGN KEY ("PartyCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_PartySubledgerMasterSid_fkey" FOREIGN KEY ("PartySubledgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_VendorCOAMasterSid_fkey" FOREIGN KEY ("VendorCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_VendorSubledgerMasterSid_fkey" FOREIGN KEY ("VendorSubledgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_ChargeCOAMasterSid_fkey" FOREIGN KEY ("ChargeCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_ChargeSubledgerMasterSid_fkey" FOREIGN KEY ("ChargeSubledgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_PartyCOAMasterSid_fkey" FOREIGN KEY ("PartyCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_PartySubledgerMasterSid_fkey" FOREIGN KEY ("PartySubledgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_VendorCOAMasterSid_fkey" FOREIGN KEY ("VendorCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_VendorSubledgerMasterSid_fkey" FOREIGN KEY ("VendorSubledgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_CostRevenueChargeSid_fkey" FOREIGN KEY ("CostRevenueChargeSid") REFERENCES "CostRevenueCharges"("CostRevenueChargesSid") ON DELETE SET NULL ON UPDATE CASCADE;
