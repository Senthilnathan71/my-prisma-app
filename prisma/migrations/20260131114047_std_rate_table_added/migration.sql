/*
  Warnings:

  - You are about to drop the column `CostRevenueChargeSid` on the `VoucherDetail` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[BookingHeaderSid]` on the table `HouseJob` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "VoucherDetail" DROP CONSTRAINT "VoucherDetail_CostRevenueChargeSid_fkey";

-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "HouseJobSid" INTEGER;

-- AlterTable
ALTER TABLE "BranchBank" ALTER COLUMN "IFSCCode" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "ReportMaster" ADD COLUMN     "Orientation" CHAR(1) NOT NULL DEFAULT 'P';

-- AlterTable
ALTER TABLE "VoucherDetail" DROP COLUMN "CostRevenueChargeSid",
ADD COLUMN     "CostRevenueChargesSid" INTEGER;

-- AlterTable
ALTER TABLE "VoucherHeader" ADD COLUMN     "BankCurrencyCode" CHAR(3),
ADD COLUMN     "BankCurrencyMasterSid" INTEGER,
ADD COLUMN     "Salesman" VARCHAR(30);

-- CreateTable
CREATE TABLE "StdRateHeader" (
    "StdRateHeaderSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "DepartmentMasterSid" INTEGER NOT NULL,
    "Remarks" VARCHAR(200),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',

    CONSTRAINT "StdRateHeader_pkey" PRIMARY KEY ("StdRateHeaderSid")
);

-- CreateTable
CREATE TABLE "StdTariffDetail" (
    "StdTariffDetailSid" SERIAL NOT NULL,
    "StdRateHeaderSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "CargoType" VARCHAR(20),
    "ChargeMasterSid" INTEGER NOT NULL,
    "ChargeName" VARCHAR(100) NOT NULL,
    "UomSid" INTEGER NOT NULL,
    "SaleCurrency" INTEGER NOT NULL,
    "SaleAmount" DECIMAL(12,3) NOT NULL,
    "CostCurrency" INTEGER NOT NULL,
    "CostAmount" DECIMAL(12,3) NOT NULL,
    "CalculationType" VARCHAR(10) NOT NULL DEFAULT 'Normal',
    "ValidFrom" DATE NOT NULL,
    "ValidTo" DATE NOT NULL,
    "Remarks" VARCHAR(200),

    CONSTRAINT "StdTariffDetail_pkey" PRIMARY KEY ("StdTariffDetailSid")
);

-- CreateIndex
CREATE UNIQUE INDEX "HouseJob_BookingHeaderSid_key" ON "HouseJob"("BookingHeaderSid");

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_BankCurrencyMasterSid_fkey" FOREIGN KEY ("BankCurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_CostRevenueChargesSid_fkey" FOREIGN KEY ("CostRevenueChargesSid") REFERENCES "CostRevenueCharges"("CostRevenueChargesSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StdRateHeader" ADD CONSTRAINT "StdRateHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StdRateHeader" ADD CONSTRAINT "StdRateHeader_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StdTariffDetail" ADD CONSTRAINT "StdTariffDetail_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StdTariffDetail" ADD CONSTRAINT "StdTariffDetail_ChargeMasterSid_fkey" FOREIGN KEY ("ChargeMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StdTariffDetail" ADD CONSTRAINT "StdTariffDetail_UomSid_fkey" FOREIGN KEY ("UomSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StdTariffDetail" ADD CONSTRAINT "StdTariffDetail_SaleCurrency_fkey" FOREIGN KEY ("SaleCurrency") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StdTariffDetail" ADD CONSTRAINT "StdTariffDetail_CostCurrency_fkey" FOREIGN KEY ("CostCurrency") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StdTariffDetail" ADD CONSTRAINT "StdTariffDetail_StdRateHeaderSid_fkey" FOREIGN KEY ("StdRateHeaderSid") REFERENCES "StdRateHeader"("StdRateHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
