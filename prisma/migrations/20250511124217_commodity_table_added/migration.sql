/*
  Warnings:

  - Added the required column `sectorCode` to the `SectorMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SectorMaster" ADD COLUMN     "sectorCode" VARCHAR(10) NOT NULL;

-- CreateTable
CREATE TABLE "HSSACMaster" (
    "HSSACMasterSid" SERIAL NOT NULL,
    "HSSACCode" VARCHAR(9) NOT NULL,
    "HSSACName" VARCHAR(30) NOT NULL,
    "ServiceName" VARCHAR(100) NOT NULL,
    "TaxRate" DECIMAL(3,1) NOT NULL,
    "TaxType" VARCHAR(10) NOT NULL,
    "EffectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300) NOT NULL,

    CONSTRAINT "HSSACMaster_pkey" PRIMARY KEY ("HSSACMasterSid")
);

-- CreateTable
CREATE TABLE "CommodityMaster" (
    "CommodityMasterSid" SERIAL NOT NULL,
    "CommodityCode" VARCHAR(10) NOT NULL,
    "CommodityName" VARCHAR(50) NOT NULL,
    "CommodityNameLL" VARCHAR(50),
    "UOMSid" INTEGER,
    "ImcoName" VARCHAR(10),
    "UNNo" VARCHAR(10),
    "PackingGroup" VARCHAR(10),
    "CommodityType" VARCHAR(10),
    "HSSACCode" INTEGER,
    "FlashPoint" VARCHAR(5),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300) NOT NULL,

    CONSTRAINT "CommodityMaster_pkey" PRIMARY KEY ("CommodityMasterSid")
);

-- AddForeignKey
ALTER TABLE "CommodityMaster" ADD CONSTRAINT "CommodityMaster_UOMSid_fkey" FOREIGN KEY ("UOMSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityMaster" ADD CONSTRAINT "CommodityMaster_HSSACCode_fkey" FOREIGN KEY ("HSSACCode") REFERENCES "HSSACMaster"("HSSACMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
