/*
  Warnings:

  - Added the required column `DepartmentMasterSid` to the `BookingHeader` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "DepartmentMasterSid" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "BookingCargo" (
    "BookingCargoSid" SERIAL NOT NULL,
    "BookingHeaderSid" VARCHAR(2) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "NoOfPackage" INTEGER,
    "FreightAmount" VARCHAR(50) NOT NULL,
    "CargoType" VARCHAR(50) NOT NULL,
    "WeightUnitSid" INTEGER,
    "GrossWeight" DECIMAL(10,3) NOT NULL,
    "NetWeight" DECIMAL(10,3),
    "Volume" DECIMAL(10,3),
    "ChargeableWeight" DECIMAL(10,3),
    "ContainerType" VARCHAR(50),
    "Qty" DECIMAL(5,0) NOT NULL,
    "ShipmentTerms" VARCHAR(10),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "BookingCargo_pkey" PRIMARY KEY ("BookingCargoSid")
);

-- CreateTable
CREATE TABLE "BookingProduct" (
    "BookingProductSid" SERIAL NOT NULL,
    "ProductName" VARCHAR(100) NOT NULL,
    "ProductDescription" VARCHAR(500) NOT NULL,
    "ShippingBillNo" VARCHAR(100) NOT NULL,
    "ShippingBillDate" TIMESTAMP(3),
    "ExternaPkg" VARCHAR(100) NOT NULL,
    "ExternlQty" VARCHAR(100) NOT NULL,
    "InternalPkg" VARCHAR(100) NOT NULL,
    "InternalQty" VARCHAR(100) NOT NULL,
    "GrossWeight" DECIMAL(10,3) NOT NULL,
    "NetWeight" DECIMAL(10,3),
    "Volume" DECIMAL(10,3),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "BookingProduct_pkey" PRIMARY KEY ("BookingProductSid")
);

-- CreateTable
CREATE TABLE "BookingConnection" (
    "BookingConnectionSid" SERIAL NOT NULL,
    "POL" VARCHAR(100) NOT NULL,
    "POD" VARCHAR(100) NOT NULL,
    "VesselName" VARCHAR(100) NOT NULL,
    "VoyageNo" VARCHAR(10) NOT NULL,
    "ETD" TIMESTAMP(3),
    "ETA" TIMESTAMP(3),
    "Remarks" VARCHAR(200) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "BookingConnection_pkey" PRIMARY KEY ("BookingConnectionSid")
);

-- CreateTable
CREATE TABLE "BookingOthers" (
    "BookingOthersSid" SERIAL NOT NULL,
    "CustomerRefNo" VARCHAR(20) NOT NULL,
    "OperationUser" VARCHAR(100) NOT NULL,
    "DocumentationUser" VARCHAR(100) NOT NULL,
    "CustomerServiceuser" VARCHAR(100) NOT NULL,
    "NotifyParty" VARCHAR(100) NOT NULL,
    "NotifyPartyAddress" VARCHAR(200) NOT NULL,
    "CHAName" VARCHAR(100) NOT NULL,
    "PickupMode" VARCHAR(10) NOT NULL,
    "YardCFS" VARCHAR(100) NOT NULL,
    "LocalTransport" CHAR(1),
    "OverseasTransport" CHAR(1),
    "OverseasClearance" CHAR(100),
    "PickupPlace" VARCHAR(100) NOT NULL,
    "PickupDate" TIMESTAMP(3),
    "PickupAddress" VARCHAR(200) NOT NULL,
    "DeliveryPlace" VARCHAR(100) NOT NULL,
    "DeliveryDate" VARCHAR(100) NOT NULL,
    "DeliveryAddress" VARCHAR(200) NOT NULL,
    "CargoCurrency" VARCHAR(3) NOT NULL,
    "CargoValue" DECIMAL(12,2) NOT NULL,
    "DeliveryMode" VARCHAR(10) NOT NULL,
    "ExternalRemarks" VARCHAR(200) NOT NULL,
    "SwitchBL" CHAR(1),
    "TransporterName" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "BookingOthers_pkey" PRIMARY KEY ("BookingOthersSid")
);

-- CreateTable
CREATE TABLE "VesselMaster" (
    "VesselMasterSid" SERIAL NOT NULL,
    "VesselName" VARCHAR(100) NOT NULL,
    "VesselShortCode" VARCHAR(5) NOT NULL,
    "IMOCode" VARCHAR(10) NOT NULL,
    "CallSignIn" VARCHAR(10) NOT NULL,
    "MMSINo" INTEGER NOT NULL,
    "GRT" INTEGER NOT NULL,
    "NRT" INTEGER NOT NULL,
    "YearofBuilt" INTEGER NOT NULL,
    "VesselOperator" VARCHAR(100) NOT NULL,
    "VesselType" VARCHAR(10) NOT NULL,
    "LengthinMtr" INTEGER NOT NULL,
    "BreadthinMtr" INTEGER NOT NULL,
    "Remarks" VARCHAR(200) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "VesselMaster_pkey" PRIMARY KEY ("VesselMasterSid")
);

-- CreateTable
CREATE TABLE "VoyageMasterHeader" (
    "VoyageMaserSid" SERIAL NOT NULL,
    "VesselMasterSid" INTEGER NOT NULL,
    "VoyageNo" VARCHAR(10) NOT NULL,
    "ViaNumber" VARCHAR(10) NOT NULL,
    "RotationNumber" VARCHAR(10) NOT NULL,
    "Remarks" VARCHAR(200) NOT NULL,
    "SCMETA" TIMESTAMP(3) NOT NULL,
    "SCMETD" TIMESTAMP(3) NOT NULL,
    "SCMTCargoDescription" VARCHAR(200) NOT NULL,
    "ShipIRN" VARCHAR(10) NOT NULL,
    "CrewIRN" VARCHAR(10) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "VoyageMasterHeader_pkey" PRIMARY KEY ("VoyageMaserSid")
);

-- CreateTable
CREATE TABLE "VoyageMasterDetail" (
    "VoyageMasterDetailSid" SERIAL NOT NULL,
    "POLSid" INTEGER NOT NULL,
    "PODSid" INTEGER NOT NULL,
    "Sno" INTEGER NOT NULL DEFAULT 1,
    "ETA" TIMESTAMP(3) NOT NULL,
    "ETD" TIMESTAMP(3) NOT NULL,
    "ATA" TIMESTAMP(3) NOT NULL,
    "ATD" TIMESTAMP(3) NOT NULL,
    "CoLoad" CHAR(1) DEFAULT 'N',
    "Coloader" VARCHAR(100) NOT NULL,
    "PortCutoff" TIMESTAMP(3) NOT NULL,
    "VoyageType" VARCHAR(10) NOT NULL,
    "TransitDays" INTEGER NOT NULL,
    "Carrier" INTEGER NOT NULL,
    "RotationNo" VARCHAR(10) NOT NULL,
    "RotationDate" TIMESTAMP(3) NOT NULL,
    "IGMNo" VARCHAR(10) NOT NULL,
    "IFMDate" TIMESTAMP(3) NOT NULL,
    "EGMNo" VARCHAR(10) NOT NULL,
    "EGMDate" TIMESTAMP(3) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "VoyageMasterDetail_pkey" PRIMARY KEY ("VoyageMasterDetailSid")
);
