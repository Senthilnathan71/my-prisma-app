/*
  Warnings:

  - You are about to drop the column `CoLoader` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedBy` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedOn` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `DestinationAgentAddress` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `DoValidity` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `FreightPPCC` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `Status` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedBy` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedOn` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedBy` on the `HouseJobCargo` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedOn` on the `HouseJobCargo` table. All the data in the column will be lost.
  - You are about to drop the column `NoOfContainer` on the `HouseJobCargo` table. All the data in the column will be lost.
  - You are about to drop the column `Status` on the `HouseJobCargo` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedBy` on the `HouseJobCargo` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedOn` on the `HouseJobCargo` table. All the data in the column will be lost.
  - You are about to drop the column `WeightUnit` on the `HouseJobCargo` table. All the data in the column will be lost.
  - You are about to drop the column `ATA` on the `HouseJobConnection` table. All the data in the column will be lost.
  - You are about to drop the column `ATD` on the `HouseJobConnection` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedBy` on the `HouseJobConnection` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedOn` on the `HouseJobConnection` table. All the data in the column will be lost.
  - You are about to drop the column `Status` on the `HouseJobConnection` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedBy` on the `HouseJobConnection` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedOn` on the `HouseJobConnection` table. All the data in the column will be lost.
  - You are about to drop the column `CoLoader` on the `HouseJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `Coload` on the `HouseJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedBy` on the `HouseJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedOn` on the `HouseJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `GeneralNote` on the `HouseJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `NominatedBy` on the `HouseJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedBy` on the `HouseJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedOn` on the `HouseJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedBy` on the `HouseJobProduct` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedOn` on the `HouseJobProduct` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedBy` on the `HouseJobProduct` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedOn` on the `HouseJobProduct` table. All the data in the column will be lost.
  - You are about to alter the column `ProductName` on the `HouseJobProduct` table. The data in that column could be lost. The data in that column will be cast from `VarChar(200)` to `VarChar(100)`.
  - Added the required column `createdBy` to the `HouseJob` table without a default value. This is not possible if the table is not empty.
  - Made the column `CustomerMasterSid` on table `HouseJob` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `createdBy` to the `HouseJobCargo` table without a default value. This is not possible if the table is not empty.
  - Made the column `CargoType` on table `HouseJobCargo` required. This step will fail if there are existing NULL values in that column.
  - Made the column `GrossWeight` on table `HouseJobCargo` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `createdBy` to the `HouseJobConnection` table without a default value. This is not possible if the table is not empty.
  - Made the column `VesselName` on table `HouseJobConnection` required. This step will fail if there are existing NULL values in that column.
  - Made the column `VoyageNo` on table `HouseJobConnection` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `createdBy` to the `HouseJobOthers` table without a default value. This is not possible if the table is not empty.
  - Made the column `CustomerRefNo` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `NotifyParty` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `NotifyPartyAddress` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `CHAName` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `YardCFS` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `PickupPlace` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `PickupAddress` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `DeliveryPlace` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `DeliveryDate` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `DeliveryAddress` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `CargoCurrency` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `CargoValue` on table `HouseJobOthers` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `createdBy` to the `HouseJobProduct` table without a default value. This is not possible if the table is not empty.
  - Made the column `ProductName` on table `HouseJobProduct` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ShippingBillNo` on table `HouseJobProduct` required. This step will fail if there are existing NULL values in that column.
  - Made the column `GrossWeight` on table `HouseJobProduct` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "HouseJob" DROP CONSTRAINT "HouseJob_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "HouseJob" DROP CONSTRAINT "HouseJob_CustomerMasterSid_fkey";

-- AlterTable
ALTER TABLE "HouseJob" DROP COLUMN "CoLoader",
DROP COLUMN "CreatedBy",
DROP COLUMN "CreatedOn",
DROP COLUMN "DestinationAgentAddress",
DROP COLUMN "DoValidity",
DROP COLUMN "FreightPPCC",
DROP COLUMN "Status",
DROP COLUMN "UpdatedBy",
DROP COLUMN "UpdatedOn",
ADD COLUMN     "AuthorizerRemarks" VARCHAR(100),
ADD COLUMN     "BookingDateTime" TIMESTAMP(3),
ADD COLUMN     "BookingStatus" VARCHAR(100),
ADD COLUMN     "CargoExpectedon" TIMESTAMP(3),
ADD COLUMN     "CarrierName" VARCHAR(200),
ADD COLUMN     "ColoadedBy" VARCHAR(200),
ADD COLUMN     "DoValid" TIMESTAMP(3),
ADD COLUMN     "EnquiryHeaderSid" INTEGER,
ADD COLUMN     "FreightTerms" VARCHAR(100),
ADD COLUMN     "GeneralNote" VARCHAR(200),
ADD COLUMN     "HouseNo" VARCHAR(20),
ADD COLUMN     "InternalNote" VARCHAR(200),
ADD COLUMN     "MBLDate" TIMESTAMP(3),
ADD COLUMN     "MBLNo" VARCHAR(200),
ADD COLUMN     "Nominated" VARCHAR(200),
ADD COLUMN     "Notify" VARCHAR(200),
ADD COLUMN     "NotifyAddress" VARCHAR(200),
ADD COLUMN     "OriginAgent" VARCHAR(200),
ADD COLUMN     "authorizerStatus" "ApprovalStatus",
ADD COLUMN     "createdBy" VARCHAR(100) NOT NULL,
ADD COLUMN     "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" CHAR(1) DEFAULT 'A',
ADD COLUMN     "updatedBy" VARCHAR(100),
ADD COLUMN     "updatedOn" TIMESTAMPTZ(6),
ALTER COLUMN "BranchMasterSid" DROP NOT NULL,
ALTER COLUMN "ShipmentNo" DROP NOT NULL,
ALTER COLUMN "ShipmentNo" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "BookingNo" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "HBLNo" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "CustomerMasterSid" SET NOT NULL,
ALTER COLUMN "CustomerName" DROP NOT NULL,
ALTER COLUMN "CustomerAddress" DROP NOT NULL,
ALTER COLUMN "ShipmentType" DROP NOT NULL,
ALTER COLUMN "ShipmentType" DROP DEFAULT,
ALTER COLUMN "NominatedBy" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "POO" DROP NOT NULL,
ALTER COLUMN "FPD" DROP NOT NULL,
ALTER COLUMN "PODTerminal" SET DATA TYPE TEXT,
ALTER COLUMN "Coload" DROP DEFAULT,
ALTER COLUMN "Coload" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "IsServiceJob" DROP NOT NULL;

-- AlterTable
ALTER TABLE "HouseJobCargo" DROP COLUMN "CreatedBy",
DROP COLUMN "CreatedOn",
DROP COLUMN "NoOfContainer",
DROP COLUMN "Status",
DROP COLUMN "UpdatedBy",
DROP COLUMN "UpdatedOn",
DROP COLUMN "WeightUnit",
ADD COLUMN     "FreightTerms" VARCHAR(100),
ADD COLUMN     "ModeOfTransport" VARCHAR(100),
ADD COLUMN     "MovementType" VARCHAR(100),
ADD COLUMN     "NoofContainers" INTEGER,
ADD COLUMN     "Qty" DECIMAL(5,0),
ADD COLUMN     "StuffingAt" VARCHAR(10),
ADD COLUMN     "WeightUnitSid" INTEGER,
ADD COLUMN     "createdBy" VARCHAR(100) NOT NULL,
ADD COLUMN     "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" CHAR(1) DEFAULT 'A',
ADD COLUMN     "updatedBy" VARCHAR(100),
ADD COLUMN     "updatedOn" TIMESTAMPTZ(6),
ALTER COLUMN "CargoType" SET NOT NULL,
ALTER COLUMN "CargoType" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "GrossWeight" SET NOT NULL,
ALTER COLUMN "FreightAmount" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "HouseJobConnection" DROP COLUMN "ATA",
DROP COLUMN "ATD",
DROP COLUMN "CreatedBy",
DROP COLUMN "CreatedOn",
DROP COLUMN "Status",
DROP COLUMN "UpdatedBy",
DROP COLUMN "UpdatedOn",
ADD COLUMN     "createdBy" VARCHAR(100) NOT NULL,
ADD COLUMN     "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" CHAR(1) DEFAULT 'A',
ADD COLUMN     "updatedBy" VARCHAR(100),
ADD COLUMN     "updatedOn" TIMESTAMPTZ(6),
ALTER COLUMN "Mode" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "VesselName" SET NOT NULL,
ALTER COLUMN "VoyageNo" SET NOT NULL;

-- AlterTable
ALTER TABLE "HouseJobOthers" DROP COLUMN "CoLoader",
DROP COLUMN "Coload",
DROP COLUMN "CreatedBy",
DROP COLUMN "CreatedOn",
DROP COLUMN "GeneralNote",
DROP COLUMN "NominatedBy",
DROP COLUMN "UpdatedBy",
DROP COLUMN "UpdatedOn",
ADD COLUMN     "AgentAddress" VARCHAR(200),
ADD COLUMN     "BacktoBack" VARCHAR(200),
ADD COLUMN     "CarrierBookingDate" TIMESTAMP(3),
ADD COLUMN     "CarrierBookingRef" VARCHAR(20),
ADD COLUMN     "Coloader" VARCHAR(100),
ADD COLUMN     "Depo" VARCHAR(200),
ADD COLUMN     "Forwarder" VARCHAR(200),
ADD COLUMN     "ForwarderAddress" VARCHAR(200),
ADD COLUMN     "HBLNo" VARCHAR(200),
ADD COLUMN     "Notify2" VARCHAR(100),
ADD COLUMN     "NotifyAddress2" VARCHAR(200),
ADD COLUMN     "ROValidity" VARCHAR(200),
ADD COLUMN     "ReleaseType" VARCHAR(200),
ADD COLUMN     "SwitchBLAgent" VARCHAR(200),
ADD COLUMN     "SwitchBLConsignee" VARCHAR(200),
ADD COLUMN     "SwitchBLShipper" VARCHAR(200),
ADD COLUMN     "SwitchLocation" VARCHAR(200),
ADD COLUMN     "createdBy" VARCHAR(100) NOT NULL,
ADD COLUMN     "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" CHAR(1) DEFAULT 'A',
ADD COLUMN     "updatedBy" VARCHAR(100),
ADD COLUMN     "updatedOn" TIMESTAMPTZ(6),
ALTER COLUMN "CustomerRefNo" SET NOT NULL,
ALTER COLUMN "NotifyParty" SET NOT NULL,
ALTER COLUMN "NotifyPartyAddress" SET NOT NULL,
ALTER COLUMN "CHAName" SET NOT NULL,
ALTER COLUMN "YardCFS" SET NOT NULL,
ALTER COLUMN "OverseasClearance" SET DATA TYPE CHAR(100),
ALTER COLUMN "PickupPlace" SET NOT NULL,
ALTER COLUMN "PickupAddress" SET NOT NULL,
ALTER COLUMN "DeliveryPlace" SET NOT NULL,
ALTER COLUMN "DeliveryDate" SET NOT NULL,
ALTER COLUMN "DeliveryDate" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "DeliveryAddress" SET NOT NULL,
ALTER COLUMN "CargoCurrency" SET NOT NULL,
ALTER COLUMN "CargoValue" SET NOT NULL;

-- AlterTable
ALTER TABLE "HouseJobProduct" DROP COLUMN "CreatedBy",
DROP COLUMN "CreatedOn",
DROP COLUMN "UpdatedBy",
DROP COLUMN "UpdatedOn",
ADD COLUMN     "ActualGrWeight" DECIMAL(10,3),
ADD COLUMN     "ActualQty" VARCHAR(100),
ADD COLUMN     "ActualVolume" DECIMAL(10,3),
ADD COLUMN     "CFS" VARCHAR(100),
ADD COLUMN     "CargoRecDate" TIMESTAMP(3),
ADD COLUMN     "Height" INTEGER,
ADD COLUMN     "ImcoClass" VARCHAR(500),
ADD COLUMN     "IsHaz" CHAR(1),
ADD COLUMN     "Length" INTEGER,
ADD COLUMN     "PkgGroup" VARCHAR(500),
ADD COLUMN     "RecdPack" VARCHAR(100),
ADD COLUMN     "UnNo" VARCHAR(500),
ADD COLUMN     "UomMasterSid" INTEGER,
ADD COLUMN     "Width" INTEGER,
ADD COLUMN     "createdBy" VARCHAR(100) NOT NULL,
ADD COLUMN     "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" CHAR(1) DEFAULT 'A',
ADD COLUMN     "updatedBy" VARCHAR(100),
ADD COLUMN     "updatedOn" TIMESTAMPTZ(6),
ALTER COLUMN "ProductName" SET NOT NULL,
ALTER COLUMN "ProductName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "ProductDescription" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "ShippingBillNo" SET NOT NULL,
ALTER COLUMN "ShippingBillNo" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "ExternaPkg" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "ExternlQty" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "InternalPkg" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "InternalQty" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "GrossWeight" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_VoyageMasterSid_fkey" FOREIGN KEY ("VoyageMasterSid") REFERENCES "VoyageMasterHeader"("VoyageMasterHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_TsPortSid_fkey" FOREIGN KEY ("TsPortSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobProduct" ADD CONSTRAINT "HouseJobProduct_UomMasterSid_fkey" FOREIGN KEY ("UomMasterSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
