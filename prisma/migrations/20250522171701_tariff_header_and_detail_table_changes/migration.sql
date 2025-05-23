/*
  Warnings:

  - You are about to drop the column `CostCurrency` on the `TariffDetail` table. All the data in the column will be lost.
  - You are about to drop the column `CostPerUnitPrice` on the `TariffDetail` table. All the data in the column will be lost.
  - You are about to drop the column `IsSlabApplicable` on the `TariffHeader` table. All the data in the column will be lost.
  - You are about to drop the column `SegmentMasterSid` on the `TariffHeader` table. All the data in the column will be lost.
  - Added the required column `BuyCurrency` to the `TariffDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `BuyPerUnitPrice` to the `TariffDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CargoType` to the `TariffDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyMasterSid` to the `TariffDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `EffectiveDate` to the `TariffDetail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyMasterSid` to the `TariffHeader` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DepartmentMasterSid` to the `TariffHeader` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TariffDetail" DROP COLUMN "CostCurrency",
DROP COLUMN "CostPerUnitPrice",
ADD COLUMN     "BuyCurrency" INTEGER NOT NULL,
ADD COLUMN     "BuyPerUnitPrice" DECIMAL(10,5) NOT NULL,
ADD COLUMN     "CargoType" VARCHAR(10) NOT NULL,
ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "EffectiveDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "IsSlabApplicable" CHAR(1) NOT NULL DEFAULT 'N';

-- AlterTable
ALTER TABLE "TariffHeader" DROP COLUMN "IsSlabApplicable",
DROP COLUMN "SegmentMasterSid",
ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "DepartmentMasterSid" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_POOSid_fkey" FOREIGN KEY ("POOSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_POLSid_fkey" FOREIGN KEY ("POLSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_PODSid_fkey" FOREIGN KEY ("PODSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_FDCSid_fkey" FOREIGN KEY ("FDCSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_Carrier_fkey" FOREIGN KEY ("Carrier") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_AgentSid_fkey" FOREIGN KEY ("AgentSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffDetail" ADD CONSTRAINT "TariffDetail_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffDetail" ADD CONSTRAINT "TariffDetail_UOMSid_fkey" FOREIGN KEY ("UOMSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffDetail" ADD CONSTRAINT "TariffDetail_SaleCurrency_fkey" FOREIGN KEY ("SaleCurrency") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffDetail" ADD CONSTRAINT "TariffDetail_BuyCurrency_fkey" FOREIGN KEY ("BuyCurrency") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
