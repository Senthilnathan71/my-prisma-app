-- CreateTable
CREATE TABLE "HouseJob" (
    "HouseJobSid" SERIAL NOT NULL,
    "MasterJobSid" INTEGER,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "MenuMasterSid" INTEGER,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "QuotationHeaderSid" INTEGER,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "ShipmentNo" VARCHAR(20) NOT NULL,
    "BookingNo" VARCHAR(20) NOT NULL,
    "HBLNo" VARCHAR(20),
    "CustomerMasterSid" INTEGER,
    "CustomerName" VARCHAR(100) NOT NULL,
    "CustomerAddress" VARCHAR(300) NOT NULL,
    "SalesmanSid" INTEGER,
    "IncoTerms" INTEGER,
    "FreightPPCC" VARCHAR(10) NOT NULL,
    "DestinationAgent" INTEGER,
    "DestinationAgentAddress" VARCHAR(300),
    "AgentName" VARCHAR(100),
    "AgentAddress" VARCHAR(300),
    "ShipperName" VARCHAR(100),
    "ShipperAddress" VARCHAR(300),
    "ConsigneeName" VARCHAR(100),
    "ConsigneeAddress" VARCHAR(300),
    "ShipmentType" VARCHAR(10) NOT NULL DEFAULT 'Self',
    "NominatedBy" VARCHAR(100),
    "VoyageMasterSid" INTEGER,
    "VesselName" VARCHAR(100),
    "VoyageNo" VARCHAR(10),
    "Carrier" INTEGER,
    "POO" VARCHAR(100) NOT NULL,
    "POL" VARCHAR(100) NOT NULL,
    "POD" VARCHAR(100) NOT NULL,
    "FPD" VARCHAR(100) NOT NULL,
    "TsPortSid" INTEGER,
    "POLTerminal" VARCHAR(100),
    "PODTerminal" VARCHAR(100),
    "ETD" TIMESTAMP(3),
    "ETA" TIMESTAMP(3),
    "Coload" CHAR(1) DEFAULT 'N',
    "CoLoader" VARCHAR(100),
    "BLLocation" INTEGER,
    "ClearanceRequire" CHAR(1),
    "MovementType" VARCHAR(10),
    "DoValidity" TIMESTAMP(3),
    "IsServiceJob" CHAR(1) NOT NULL,

    CONSTRAINT "HouseJob_pkey" PRIMARY KEY ("HouseJobSid")
);

-- CreateTable
CREATE TABLE "HouseJobCargo" (
    "HouseJobCargoSid" SERIAL NOT NULL,
    "HouseJobSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CargoType" VARCHAR(10),
    "ContainerType" INTEGER,
    "GrossWeight" DECIMAL(10,3),
    "NetWeight" DECIMAL(10,3),
    "Volume" DECIMAL(10,3),
    "ChargeableWeight" DECIMAL(10,3),
    "PackageType" INTEGER,
    "NoOfPackage" INTEGER,
    "FreightAmount" DECIMAL(12,2),
    "WeightUnit" INTEGER,
    "ShipmentTerms" VARCHAR(10),

    CONSTRAINT "HouseJobCargo_pkey" PRIMARY KEY ("HouseJobCargoSid")
);

-- CreateTable
CREATE TABLE "HouseJobProduct" (
    "HouseJobProductSid" SERIAL NOT NULL,
    "HouseJobSid" INTEGER NOT NULL,
    "ProductName" VARCHAR(200),
    "ProductDescription" VARCHAR(300),
    "ShippingBillNo" VARCHAR(50),
    "ShippingBillDate" TIMESTAMP(3),
    "ExternaPkg" INTEGER,
    "ExternlQty" INTEGER,
    "InternalPkg" INTEGER,
    "InternalQty" INTEGER,
    "GrossWeight" DECIMAL(10,3),
    "NetWeight" DECIMAL(10,3),
    "Volume" DECIMAL(10,3),
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),

    CONSTRAINT "HouseJobProduct_pkey" PRIMARY KEY ("HouseJobProductSid")
);

-- CreateTable
CREATE TABLE "HouseJobConnection" (
    "HouseJobConnectionSid" SERIAL NOT NULL,
    "HouseJobSid" INTEGER,
    "Mode" VARCHAR(10),
    "POL" VARCHAR(100) NOT NULL,
    "POD" VARCHAR(100) NOT NULL,
    "VesselName" VARCHAR(100),
    "VoyageNo" VARCHAR(10),
    "ETD" TIMESTAMP(3),
    "ETA" TIMESTAMP(3),
    "ATD" TIMESTAMP(3),
    "ATA" TIMESTAMP(3),
    "Remarks" VARCHAR(200),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),

    CONSTRAINT "HouseJobConnection_pkey" PRIMARY KEY ("HouseJobConnectionSid")
);

-- CreateTable
CREATE TABLE "HouseJobOthers" (
    "HouseJobOthersSid" SERIAL NOT NULL,
    "HouseJobSid" INTEGER NOT NULL,
    "CustomerRefNo" VARCHAR(20),
    "OperationUser" VARCHAR(100),
    "DocumentationUser" VARCHAR(100),
    "CustomerServiceuser" VARCHAR(100),
    "NotifyParty" VARCHAR(100),
    "NotifyPartyAddress" VARCHAR(200),
    "CHAName" VARCHAR(100),
    "PickupMode" VARCHAR(10),
    "YardCFS" VARCHAR(100),
    "LocalTransport" CHAR(1),
    "OverseasTransport" CHAR(1),
    "OverseasClearance" VARCHAR(100),
    "PickupPlace" VARCHAR(100),
    "PickupDate" TIMESTAMP(3),
    "PickupAddress" VARCHAR(200),
    "DeliveryPlace" VARCHAR(100),
    "DeliveryDate" TIMESTAMP(3),
    "DeliveryAddress" VARCHAR(200),
    "CargoCurrency" VARCHAR(3),
    "CargoValue" DECIMAL(12,2),
    "DeliveryMode" VARCHAR(10),
    "ExternalRemarks" VARCHAR(200),
    "GeneralNote" VARCHAR(200),
    "SwitchBL" CHAR(1),
    "TransporterName" VARCHAR(100),
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Coload" CHAR(1),
    "CoLoader" VARCHAR(100),
    "NominatedBy" VARCHAR(100),

    CONSTRAINT "HouseJobOthers_pkey" PRIMARY KEY ("HouseJobOthersSid")
);

-- CreateTable
CREATE TABLE "MasterJobConnection" (
    "MasterJobConnectionSid" SERIAL NOT NULL,
    "MasterJobSid" INTEGER NOT NULL,
    "Mode" VARCHAR(10),
    "POL" VARCHAR(100) NOT NULL,
    "POD" VARCHAR(100) NOT NULL,
    "VesselName" VARCHAR(100),
    "VoyageNo" VARCHAR(10),
    "ETD" TIMESTAMP(3),
    "ETA" TIMESTAMP(3),
    "ATD" TIMESTAMP(3),
    "ATA" TIMESTAMP(3),
    "Remarks" VARCHAR(200),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),

    CONSTRAINT "MasterJobConnection_pkey" PRIMARY KEY ("MasterJobConnectionSid")
);

-- AddForeignKey
ALTER TABLE "MasterJobVoyage" ADD CONSTRAINT "MasterJobVoyage_VoyageMasterSid_fkey" FOREIGN KEY ("VoyageMasterSid") REFERENCES "VoyageMasterHeader"("VoyageMasterHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_QuotationHeaderSid_fkey" FOREIGN KEY ("QuotationHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_VoyageMasterSid_fkey" FOREIGN KEY ("VoyageMasterSid") REFERENCES "VoyageMasterHeader"("VoyageMasterHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobCargo" ADD CONSTRAINT "HouseJobCargo_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobProduct" ADD CONSTRAINT "HouseJobProduct_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobConnection" ADD CONSTRAINT "HouseJobConnection_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobOthers" ADD CONSTRAINT "HouseJobOthers_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterJobConnection" ADD CONSTRAINT "MasterJobConnection_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;
