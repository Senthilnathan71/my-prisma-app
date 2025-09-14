/*
  Warnings:

  - You are about to drop the column `Amount` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `CostRevenue` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `CurrencyMasterSid` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `DrCr` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `ExchangeRate` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `LocalAmount` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `NumberOfUnit` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `PrepaidCollect` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `Rate` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `VoucherTypeSid` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `BookingRates` table. All the data in the column will be lost.
  - You are about to drop the column `Amount` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `CostRevenue` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `CurrencyMasterSid` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `CustomerBranchSid` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `CustomerMasterSid` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `DrCr` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `ExchangeRate` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `LocalAmount` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `NumberOfUnit` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `PrepaidCollect` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `Rate` on the `CostRevenueCharges` table. All the data in the column will be lost.
  - You are about to drop the column `DocumentTypeMasterSid` on the `VoucherHeader` table. All the data in the column will be lost.
  - You are about to drop the column `IRNNumber` on the `VoucherHeader` table. All the data in the column will be lost.
  - You are about to drop the column `IRNStatus` on the `VoucherHeader` table. All the data in the column will be lost.
  - You are about to drop the column `DocumentTypeMasterSid` on the `VoucherTransaction` table. All the data in the column will be lost.
  - You are about to drop the `DocumentTypeMaster` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `CostAmount` to the `BookingRates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CostDrCr` to the `BookingRates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CostLocalAmount` to the `BookingRates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `RevenueAmount` to the `BookingRates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `RevenueDrCr` to the `BookingRates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `RevenueLocalAmount` to the `BookingRates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CostChargeUomSid` to the `CostRevenueCharges` table without a default value. This is not possible if the table is not empty.
  - Added the required column `RevenueChargeUomSid` to the `CostRevenueCharges` table without a default value. This is not possible if the table is not empty.
  - Added the required column `VoucherTypeMasterSid` to the `VoucherHeader` table without a default value. This is not possible if the table is not empty.
  - Added the required column `VoucherTypeMasterSid` to the `VoucherTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CostRevenueCharges" DROP CONSTRAINT "CostRevenueCharges_CurrencyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CostRevenueCharges" DROP CONSTRAINT "CostRevenueCharges_CustomerBranchSid_fkey";

-- DropForeignKey
ALTER TABLE "CostRevenueCharges" DROP CONSTRAINT "CostRevenueCharges_CustomerMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "DocumentTypeMaster" DROP CONSTRAINT "DocumentTypeMaster_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "DocumentTypeMaster" DROP CONSTRAINT "DocumentTypeMaster_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherHeader" DROP CONSTRAINT "VoucherHeader_DocumentTypeMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherTransaction" DROP CONSTRAINT "VoucherTransaction_DocumentTypeMasterSid_fkey";

-- AlterTable
ALTER TABLE "BookingRates" DROP COLUMN "Amount",
DROP COLUMN "CostRevenue",
DROP COLUMN "CurrencyMasterSid",
DROP COLUMN "DrCr",
DROP COLUMN "ExchangeRate",
DROP COLUMN "LocalAmount",
DROP COLUMN "NumberOfUnit",
DROP COLUMN "PrepaidCollect",
DROP COLUMN "Rate",
DROP COLUMN "VoucherTypeSid",
DROP COLUMN "deletedAt",
ADD COLUMN     "AgentBranchSid" INTEGER,
ADD COLUMN     "AgentMasterSid" INTEGER,
ADD COLUMN     "CostAmount" DECIMAL(15,3) NOT NULL,
ADD COLUMN     "CostChargeUomSid" INTEGER,
ADD COLUMN     "CostCurrencyMasterSid" INTEGER,
ADD COLUMN     "CostDrCr" CHAR(1) NOT NULL,
ADD COLUMN     "CostExchangeRate" DECIMAL(6,3),
ADD COLUMN     "CostLocalAmount" DECIMAL(15,3) NOT NULL,
ADD COLUMN     "CostNumberOfUnit" DECIMAL(4,3),
ADD COLUMN     "CostPrepaidCollect" VARCHAR(10) DEFAULT 'Prepaid',
ADD COLUMN     "CostRate" DECIMAL(15,3),
ADD COLUMN     "RevenueAmount" DECIMAL(15,3) NOT NULL,
ADD COLUMN     "RevenueChargeUomSid" INTEGER,
ADD COLUMN     "RevenueCurrencyMasterSid" INTEGER,
ADD COLUMN     "RevenueDrCr" CHAR(1) NOT NULL,
ADD COLUMN     "RevenueLocalAmount" DECIMAL(15,3) NOT NULL,
ADD COLUMN     "RevenuePrepaidCollect" TEXT,
ADD COLUMN     "RevenueRate" DECIMAL(15,3),
ADD COLUMN     "ReveueNumberOfUnit" DECIMAL(4,3),
ADD COLUMN     "RevnueExchangeRate" DECIMAL(6,3),
ADD COLUMN     "VoucherTypeMasterSid" INTEGER,
ALTER COLUMN "SerialNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CostRevenueCharges" DROP COLUMN "Amount",
DROP COLUMN "CostRevenue",
DROP COLUMN "CurrencyMasterSid",
DROP COLUMN "CustomerBranchSid",
DROP COLUMN "CustomerMasterSid",
DROP COLUMN "DrCr",
DROP COLUMN "ExchangeRate",
DROP COLUMN "LocalAmount",
DROP COLUMN "NumberOfUnit",
DROP COLUMN "PrepaidCollect",
DROP COLUMN "Rate",
ADD COLUMN     "CostAgentBranchSid" INTEGER,
ADD COLUMN     "CostAgentMasterSid" INTEGER,
ADD COLUMN     "CostAmount" DECIMAL(15,3),
ADD COLUMN     "CostChargeUomSid" INTEGER NOT NULL,
ADD COLUMN     "CostCurrencyMasterSid" INTEGER,
ADD COLUMN     "CostDrCr" CHAR(1),
ADD COLUMN     "CostExchangeRate" DECIMAL(6,3),
ADD COLUMN     "CostLocalAmount" DECIMAL(15,3),
ADD COLUMN     "CostNumberOfUnit" DECIMAL(4,3),
ADD COLUMN     "CostPrepaidCollect" VARCHAR(10),
ADD COLUMN     "CostRate" DECIMAL(15,3),
ADD COLUMN     "RevenueAmount" DECIMAL(15,3),
ADD COLUMN     "RevenueChargeUomSid" INTEGER NOT NULL,
ADD COLUMN     "RevenueCurrencyMasterSid" INTEGER,
ADD COLUMN     "RevenueCustomerBranchSid" INTEGER,
ADD COLUMN     "RevenueCustomerMasterSid" INTEGER,
ADD COLUMN     "RevenueDrCr" CHAR(1),
ADD COLUMN     "RevenueExchangeRate" DECIMAL(6,3),
ADD COLUMN     "RevenueLocalAmount" DECIMAL(15,3),
ADD COLUMN     "RevenueNumberOfUnit" DECIMAL(4,3),
ADD COLUMN     "RevenuePrepaidCollect" VARCHAR(10),
ADD COLUMN     "RevenueRate" DECIMAL(15,3);

-- AlterTable
ALTER TABLE "VoucherDetail" ADD COLUMN     "ChargeUOMSid" INTEGER;

-- AlterTable
ALTER TABLE "VoucherHeader" DROP COLUMN "DocumentTypeMasterSid",
DROP COLUMN "IRNNumber",
DROP COLUMN "IRNStatus",
ADD COLUMN     "VoucherTypeMasterSid" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "VoucherOthers" ADD COLUMN     "IRNNumber" VARCHAR(100),
ADD COLUMN     "IRNQRCode" VARCHAR(300),
ADD COLUMN     "IRNStatus" VARCHAR(10);

-- AlterTable
ALTER TABLE "VoucherTransaction" DROP COLUMN "DocumentTypeMasterSid",
ADD COLUMN     "VoucherTypeMasterSid" INTEGER NOT NULL;

-- DropTable
DROP TABLE "DocumentTypeMaster";

-- CreateTable
CREATE TABLE "VoucherTypeMaster" (
    "VoucherTypeMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(500),
    "BranchFlag" CHAR(1) NOT NULL DEFAULT 'N',
    "BranchValue" CHAR(3),
    "COAGroup" INTEGER,
    "COALedger" INTEGER,
    "COASubgroup" INTEGER,
    "CompanyFlag" CHAR(1) NOT NULL DEFAULT 'N',
    "CompanyValue" CHAR(3),
    "CurrencyCode" VARCHAR(3) NOT NULL,
    "DocumentFlag" CHAR(1) NOT NULL DEFAULT 'N',
    "DocumentSLNoLength" DECIMAL(2,0) NOT NULL,
    "DocumentSeparator" CHAR(1) NOT NULL,
    "DocumentStartingNo" DECIMAL(5,0) NOT NULL,
    "DocumentTypeCode" VARCHAR(5) NOT NULL,
    "DocumentTypeName" VARCHAR(30) NOT NULL,
    "DocumentValue" CHAR(3),
    "MonthFlag" CHAR(1) NOT NULL DEFAULT 'N',
    "ResetValue" VARCHAR(15) NOT NULL,
    "Subledger" INTEGER,
    "YearFlag" CHAR(1) NOT NULL DEFAULT 'N',
    "ReportFooter" VARCHAR(100),
    "ReportTitle" VARCHAR(100),
    "Type" VARCHAR(100),

    CONSTRAINT "VoucherTypeMaster_pkey" PRIMARY KEY ("VoucherTypeMasterSid")
);

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_VoucherTypeMasterSid_fkey" FOREIGN KEY ("VoucherTypeMasterSid") REFERENCES "VoucherTypeMaster"("VoucherTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CostChargeUomSid_fkey" FOREIGN KEY ("CostChargeUomSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_RevenueChargeUomSid_fkey" FOREIGN KEY ("RevenueChargeUomSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CostAgentBranchSid_fkey" FOREIGN KEY ("CostAgentBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_RevenueCustomerBranchSid_fkey" FOREIGN KEY ("RevenueCustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CostAgentMasterSid_fkey" FOREIGN KEY ("CostAgentMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_RevenueCustomerMasterSid_fkey" FOREIGN KEY ("RevenueCustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CostCurrencyMasterSid_fkey" FOREIGN KEY ("CostCurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_RevenueCurrencyMasterSid_fkey" FOREIGN KEY ("RevenueCurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CostChargeUomSid_fkey" FOREIGN KEY ("CostChargeUomSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_RevenueChargeUomSid_fkey" FOREIGN KEY ("RevenueChargeUomSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTypeMaster" ADD CONSTRAINT "VoucherTypeMaster_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTypeMaster" ADD CONSTRAINT "VoucherTypeMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_VoucherTypeMasterSid_fkey" FOREIGN KEY ("VoucherTypeMasterSid") REFERENCES "VoucherTypeMaster"("VoucherTypeMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_VoucherTypeMasterSid_fkey" FOREIGN KEY ("VoucherTypeMasterSid") REFERENCES "VoucherTypeMaster"("VoucherTypeMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
