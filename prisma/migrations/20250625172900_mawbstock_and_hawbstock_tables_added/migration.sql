-- CreateTable
CREATE TABLE "HawbStock" (
    "HawbStockSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "AirwayBillType" VARCHAR(10) NOT NULL DEFAULT 'Airline',
    "AirwayBillNumber" VARCHAR(20) NOT NULL,
    "Agent" INTEGER,
    "HAWBSerial" VARCHAR(15) NOT NULL,
    "NumberofHAWB" DECIMAL(3,0) NOT NULL,
    "ReceivedDate" TIMESTAMP(3) NOT NULL,
    "StockStatus" VARCHAR(10) NOT NULL DEFAULT 'Free',
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(500),

    CONSTRAINT "HawbStock_pkey" PRIMARY KEY ("HawbStockSid")
);

-- CreateTable
CREATE TABLE "MawbStock" (
    "MawbStockSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "AirwayBillType" VARCHAR(10) NOT NULL DEFAULT 'Airline',
    "MasterBillNumber" VARCHAR(20) NOT NULL,
    "Agent" INTEGER,
    "MAWBSerial" VARCHAR(15) NOT NULL,
    "NumberofMAWB" DECIMAL(3,0) NOT NULL,
    "ReceivedDate" TIMESTAMP(3) NOT NULL,
    "StockStatus" VARCHAR(10) NOT NULL DEFAULT 'Free',
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(500),

    CONSTRAINT "MawbStock_pkey" PRIMARY KEY ("MawbStockSid")
);

-- AddForeignKey
ALTER TABLE "HawbStock" ADD CONSTRAINT "HawbStock_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HawbStock" ADD CONSTRAINT "HawbStock_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HawbStock" ADD CONSTRAINT "HawbStock_Agent_fkey" FOREIGN KEY ("Agent") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MawbStock" ADD CONSTRAINT "MawbStock_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MawbStock" ADD CONSTRAINT "MawbStock_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MawbStock" ADD CONSTRAINT "MawbStock_Agent_fkey" FOREIGN KEY ("Agent") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
