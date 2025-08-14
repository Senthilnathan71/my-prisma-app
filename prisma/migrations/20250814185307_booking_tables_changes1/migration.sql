-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "PODTerminal" TEXT,
ADD COLUMN     "ShipmentNo" VARCHAR(200);

-- AlterTable
ALTER TABLE "BookingOthers" ADD COLUMN     "BacktoBack" VARCHAR(200),
ADD COLUMN     "Depo" VARCHAR(200),
ADD COLUMN     "ROValidity" VARCHAR(200),
ADD COLUMN     "ReleaseType" VARCHAR(200);

-- CreateTable
CREATE TABLE "BookingRates" (
    "BookingRatesSid" SERIAL NOT NULL,
    "BookingHeaderSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL,
    "SerialNumber" DECIMAL(3,0) NOT NULL,
    "ChargeMasterSid" INTEGER NOT NULL,
    "ChargeDescription" VARCHAR(100) NOT NULL,
    "ChargeUomSid" INTEGER NOT NULL,
    "PrepaidCollect" VARCHAR(10) NOT NULL DEFAULT 'Prepaid',
    "CostRevenue" VARCHAR(10),
    "CurrencyMasterSid" INTEGER NOT NULL,
    "ExchangeRate" DECIMAL(6,3) NOT NULL,
    "Rate" DECIMAL(15,3) NOT NULL,
    "NumberOfUnit" DECIMAL(4,3) NOT NULL,
    "DrCr" CHAR(1) NOT NULL,
    "Amount" DECIMAL(15,3) NOT NULL,
    "LocalAmount" DECIMAL(15,3) NOT NULL,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER NOT NULL,
    "VoucherHeaderSid" INTEGER,
    "VoucherTypeSid" INTEGER,
    "Remarks" VARCHAR(100),

    CONSTRAINT "BookingRates_pkey" PRIMARY KEY ("BookingRatesSid")
);

-- CreateTable
CREATE TABLE "ShipmentMilestone" (
    "ShipmentMilestoneSid" SERIAL NOT NULL,
    "ShipmentNo" VARCHAR(20) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL,
    "MilestoneMasterSid" INTEGER NOT NULL,
    "MilestoneName" VARCHAR(50) NOT NULL,
    "MilestoneDate" TIMESTAMP(3) NOT NULL,
    "AutoCaptured" CHAR(1) NOT NULL,
    "Remarks" VARCHAR(200),

    CONSTRAINT "ShipmentMilestone_pkey" PRIMARY KEY ("ShipmentMilestoneSid")
);

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentMilestone" ADD CONSTRAINT "ShipmentMilestone_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentMilestone" ADD CONSTRAINT "ShipmentMilestone_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
