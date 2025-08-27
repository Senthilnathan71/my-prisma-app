-- CreateTable
CREATE TABLE "MasterJob" (
    "MasterJobSid" SERIAL NOT NULL,
    "MasterJobNumber" VARCHAR(20),
    "MasterJobDate" DATE,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',
    "MenuMasterSid" INTEGER,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "FreightPPCC" VARCHAR(10) NOT NULL,
    "DestinationAgent" INTEGER,
    "DestinationAgentName" VARCHAR(100),
    "DestinationAgentAddress" VARCHAR(300),
    "MBLNo" VARCHAR(20),
    "MBLDate" DATE,
    "BLReleaseType" VARCHAR(15),
    "NoofOriginal" INTEGER,
    "OriginAgent" INTEGER,
    "POO" VARCHAR(100) NOT NULL,
    "POL" VARCHAR(100) NOT NULL,
    "POD" VARCHAR(100) NOT NULL,
    "FPD" VARCHAR(100) NOT NULL,
    "TsPortSid" INTEGER,
    "POLTerminal" VARCHAR(100),
    "PODTerminal" VARCHAR(100),
    "MovementType" VARCHAR(10),
    "ShipmentTerms" VARCHAR(10),
    "PkgType" INTEGER,
    "NoOfPkg" INTEGER,
    "WeightIn" VARCHAR(10),
    "GrossWeight" DECIMAL(10,3),
    "NetWeight" DECIMAL(10,3),
    "ChargeableWeight" DECIMAL(10,3),
    "Volume" DECIMAL(8,3),
    "Haz" CHAR(1),
    "DGBookingDate" DATE,
    "DGApprovedDate" DATE,
    "CommodityDescription" VARCHAR(3000),
    "MarksandNumber" VARCHAR(500),

    CONSTRAINT "MasterJob_pkey" PRIMARY KEY ("MasterJobSid")
);

-- CreateTable
CREATE TABLE "MasterJobVoyage" (
    "MasterJobVoyageSid" SERIAL NOT NULL,
    "MasterJobSid" INTEGER NOT NULL,
    "VoyageMasterSid" INTEGER,
    "VesselName" VARCHAR(100),
    "VoyageNo" VARCHAR(10),
    "ETD" DATE,
    "ETA" DATE,
    "ATA" DATE,
    "ATD" DATE,
    "DestinationATA" DATE,
    "CarrierMasterSid" INTEGER,
    "CarrierName" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "MasterJobVoyage_pkey" PRIMARY KEY ("MasterJobVoyageSid")
);

-- CreateTable
CREATE TABLE "MasterJobOthers" (
    "MasterJobOthersSid" SERIAL NOT NULL,
    "MasterJobSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',
    "Yard" INTEGER,
    "YardAddress" VARCHAR(100),
    "Transporter" VARCHAR(100),
    "HandlingInformation" VARCHAR(300),
    "InternalNote" VARCHAR(300),
    "CFS" INTEGER,
    "CFSAddress" VARCHAR(100),
    "StuffingStartDate" TIMESTAMP(3),
    "StuffingEndDate" TIMESTAMP(3),
    "CurrencyCode" VARCHAR(3),
    "SellExchangeRate" INTEGER,
    "AgentExchangeRate" INTEGER,
    "Coload" CHAR(1),
    "CoLoader" VARCHAR(100),
    "ExportDoNo" VARCHAR(20),
    "ExportDoDate" DATE,
    "SOBDate" DATE,

    CONSTRAINT "MasterJobOthers_pkey" PRIMARY KEY ("MasterJobOthersSid")
);

-- CreateTable
CREATE TABLE "MasterJobContainer" (
    "MasterJobContainerSid" SERIAL NOT NULL,
    "MasterJobSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',
    "ContainerType" INTEGER NOT NULL,
    "ContainerNumber" VARCHAR(11) NOT NULL,
    "LineSeal" VARCHAR(10),
    "CustomsSeal" VARCHAR(10),
    "HsCode" VARCHAR(10),
    "CommodityDescription" VARCHAR(500),
    "PkgType" INTEGER,
    "NoOfPkg" INTEGER,
    "GrossWeight" DECIMAL(10,3),
    "NetWeight" DECIMAL(10,3),
    "ChargeableWeight" DECIMAL(10,3),
    "Volume" DECIMAL(8,3),
    "IsSoc" CHAR(1),

    CONSTRAINT "MasterJobContainer_pkey" PRIMARY KEY ("MasterJobContainerSid")
);

-- AddForeignKey
ALTER TABLE "MasterJob" ADD CONSTRAINT "MasterJob_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterJob" ADD CONSTRAINT "MasterJob_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterJob" ADD CONSTRAINT "MasterJob_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterJobVoyage" ADD CONSTRAINT "MasterJobVoyage_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterJobOthers" ADD CONSTRAINT "MasterJobOthers_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterJobContainer" ADD CONSTRAINT "MasterJobContainer_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;
