-- AlterTable
ALTER TABLE "CostRevenueCharges" ADD COLUMN     "TariffDetailSid" INTEGER;

-- AlterTable
ALTER TABLE "HouseJobOthers" ADD COLUMN     "IATARate" DECIMAL(13,3),
ADD COLUMN     "PlaceOfSupply" VARCHAR(100);

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_TariffDetailSid_fkey" FOREIGN KEY ("TariffDetailSid") REFERENCES "TariffDetail"("TariffDetailSid") ON DELETE SET NULL ON UPDATE CASCADE;
