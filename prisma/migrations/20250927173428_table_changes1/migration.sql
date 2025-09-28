/*
  Warnings:

  - You are about to drop the column `IncoTerms` on the `QuoteHeader` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BookingRates" ADD COLUMN     "QuoteChargeSid" INTEGER,
ADD COLUMN     "TariffDetailSid" INTEGER;

-- AlterTable
ALTER TABLE "ChargeMaster" ADD COLUMN     "UnitQty" TEXT;

-- AlterTable
ALTER TABLE "CurrencyExchange" ALTER COLUMN "SellRate" DROP NOT NULL,
ALTER COLUMN "SellRate" SET DATA TYPE DECIMAL(9,5),
ALTER COLUMN "BuyRate" DROP NOT NULL,
ALTER COLUMN "BuyRate" SET DATA TYPE DECIMAL(9,5);

-- AlterTable
ALTER TABLE "HouseJob" ADD COLUMN     "BookingRateSid" INTEGER;

-- AlterTable
ALTER TABLE "QuoteCarrier" ADD COLUMN     "TransitTime" TEXT,
ALTER COLUMN "CarrierName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "QuoteCharge" ADD COLUMN     "TariffDetailSid" INTEGER;

-- AlterTable
ALTER TABLE "QuoteHeader" DROP COLUMN "IncoTerms",
ADD COLUMN     "AgreedRate" VARCHAR(10) DEFAULT 'N',
ADD COLUMN     "IncoTermSid" INTEGER;

-- AlterTable
ALTER TABLE "VoyageMasterHeader" ADD COLUMN     "BranchMasterSid" INTEGER,
ADD COLUMN     "CompanyMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_TariffDetailSid_fkey" FOREIGN KEY ("TariffDetailSid") REFERENCES "TariffDetail"("TariffDetailSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_QuoteChargeSid_fkey" FOREIGN KEY ("QuoteChargeSid") REFERENCES "QuoteCharge"("QuoteChargeSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageMasterHeader" ADD CONSTRAINT "VoyageMasterHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageMasterHeader" ADD CONSTRAINT "VoyageMasterHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_TariffDetailSid_fkey" FOREIGN KEY ("TariffDetailSid") REFERENCES "TariffDetail"("TariffDetailSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_BookingRateSid_fkey" FOREIGN KEY ("BookingRateSid") REFERENCES "BookingRates"("BookingRatesSid") ON DELETE SET NULL ON UPDATE CASCADE;
