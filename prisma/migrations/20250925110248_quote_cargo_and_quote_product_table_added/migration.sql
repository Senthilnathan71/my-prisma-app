/*
  Warnings:

  - You are about to drop the column `RevenyeChargeUomSid` on the `QuoteCharge` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "QuoteCharge" DROP CONSTRAINT "QuoteCharge_CurrencyMasterSid_fkey";

-- AlterTable
ALTER TABLE "QuoteCharge" DROP COLUMN "RevenyeChargeUomSid",
ADD COLUMN     "RevenueChargeUomSid" INTEGER,
ALTER COLUMN "CurrencyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TariffHeader" ALTER COLUMN "EffectiveDate" DROP NOT NULL;

-- CreateTable
CREATE TABLE "QuoteCargo" (
    "QuoteCargoSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "QuoteHeaderSid" INTEGER NOT NULL,
    "QuoteRouteSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',
    "CargoType" VARCHAR(10) NOT NULL,
    "WeightUnitSid" INTEGER,
    "GrossWeight" DECIMAL(10,3),
    "NetWeight" DECIMAL(10,3),
    "Volume" DECIMAL(10,3),
    "ChargeableWeight" DECIMAL(10,3),
    "ContainerType" VARCHAR(10) NOT NULL,
    "Qty" DECIMAL(5,0),
    "ShipmentTerms" VARCHAR(10),
    "ProductName" VARCHAR(50),
    "PackageType" VARCHAR(5),
    "PackageQty" DECIMAL(5,0),
    "CargoDescription" VARCHAR(200),

    CONSTRAINT "QuoteCargo_pkey" PRIMARY KEY ("QuoteCargoSid")
);

-- CreateTable
CREATE TABLE "QuoteProduct" (
    "QuoteProductSid" SERIAL NOT NULL,
    "Sno" INTEGER NOT NULL,
    "ProductSid" INTEGER NOT NULL,
    "ProductName" VARCHAR(20) NOT NULL,
    "PackageType" VARCHAR(5) NOT NULL,
    "CargoDescription" VARCHAR(100) NOT NULL,
    "ProductUnit" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "QuoteHeaderSid" INTEGER NOT NULL,
    "QuoteCargoSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL,
    "UpdatedBy" VARCHAR(100),
    "LoginSid" INTEGER,
    "Status" CHAR(1) DEFAULT 'A',
    "ExternalPkg" INTEGER,
    "ExternalQty" INTEGER,
    "GrossWeight" DECIMAL(10,3),
    "NetWeight" DECIMAL(10,3),
    "Volume" DECIMAL(10,3),
    "Length" DECIMAL(10,3),
    "Width" DECIMAL(10,3),
    "Height" DECIMAL(10,3),
    "ChargeableWeight" DECIMAL(10,3),
    "IsHaz" CHAR(1),
    "ImcoClass" INTEGER,
    "PkgGroup" INTEGER,
    "Remarks" VARCHAR(200),

    CONSTRAINT "QuoteProduct_pkey" PRIMARY KEY ("QuoteProductSid")
);

-- AddForeignKey
ALTER TABLE "QuoteCargo" ADD CONSTRAINT "QuoteCargo_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCargo" ADD CONSTRAINT "QuoteCargo_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCargo" ADD CONSTRAINT "QuoteCargo_QuoteHeaderSid_fkey" FOREIGN KEY ("QuoteHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCargo" ADD CONSTRAINT "QuoteCargo_WeightUnitSid_fkey" FOREIGN KEY ("WeightUnitSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCargo" ADD CONSTRAINT "QuoteCargo_QuoteRouteSid_fkey" FOREIGN KEY ("QuoteRouteSid") REFERENCES "QuoteRoute"("QuoteRouteSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteProduct" ADD CONSTRAINT "QuoteProduct_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteProduct" ADD CONSTRAINT "QuoteProduct_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteProduct" ADD CONSTRAINT "QuoteProduct_QuoteHeaderSid_fkey" FOREIGN KEY ("QuoteHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteProduct" ADD CONSTRAINT "QuoteProduct_QuoteCargoSid_fkey" FOREIGN KEY ("QuoteCargoSid") REFERENCES "QuoteCargo"("QuoteCargoSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
