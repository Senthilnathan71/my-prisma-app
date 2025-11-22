-- CreateTable
CREATE TABLE "HouseJobVehicle" (
    "HouseJobVehicleSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "HouseJobSid" INTEGER NOT NULL,
    "VehicleIndicator" CHAR(1),
    "UsedNew" CHAR(1),
    "ChassisNo" VARCHAR(24),
    "CaseNo" VARCHAR(24),
    "Make" VARCHAR(20),
    "Model" VARCHAR(20),
    "EngineNo" VARCHAR(30),
    "YearBuilt" VARCHAR(4),
    "Color" VARCHAR(16),
    "Rolling" CHAR(1),
    "GoodsDescription" VARCHAR(200),
    "Weight" DECIMAL(9,3),
    "Volume" DECIMAL(9,3),
    "Remarks" VARCHAR(200),

    CONSTRAINT "HouseJobVehicle_pkey" PRIMARY KEY ("HouseJobVehicleSid")
);

-- CreateTable
CREATE TABLE "HouseJobCustoms" (
    "HouseJobCustomsSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "HouseJobSid" INTEGER NOT NULL,
    "LineCode" VARCHAR(6) NOT NULL,
    "VoyageAgentCode" VARCHAR(6) NOT NULL,
    "RotationNumber" VARCHAR(6) NOT NULL,
    "ManifestSequence" VARCHAR(5) NOT NULL,
    "CargoCode" CHAR(1) NOT NULL,
    "StorageRequest" CHAR(1),
    "PackageTypeCode" CHAR(3) NOT NULL,
    "FreightTonne" DECIMAL(9,3),
    "NoOfPallets" DECIMAL(4,0),
    "SLACIndicator" CHAR(1),
    "ImporterCode" VARCHAR(5) NOT NULL,
    "SerialNumber" DECIMAL(6,0) NOT NULL,
    "UsedOrNew" CHAR(1),
    "UNHSCode" VARCHAR(10) NOT NULL,
    "UNNumber" VARCHAR(5),
    "FlashPoints" DECIMAL(4,1),
    "TemperatureUnit" CHAR(1),
    "HazStorageRequest" CHAR(1),
    "RefrigerationRequired" CHAR(1),
    "MinTemperature" DECIMAL(4,1),
    "MaxTemperature" DECIMAL(4,1),
    "RefTemperatureUnit" CHAR(1),

    CONSTRAINT "HouseJobCustoms_pkey" PRIMARY KEY ("HouseJobCustomsSid")
);

-- AddForeignKey
ALTER TABLE "HouseJobVehicle" ADD CONSTRAINT "HouseJobVehicle_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobVehicle" ADD CONSTRAINT "HouseJobVehicle_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobCustoms" ADD CONSTRAINT "HouseJobCustoms_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobCustoms" ADD CONSTRAINT "HouseJobCustoms_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
