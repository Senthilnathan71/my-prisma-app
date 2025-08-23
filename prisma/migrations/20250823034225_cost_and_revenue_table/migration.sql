-- CreateTable
CREATE TABLE "CostRevenueCharges" (
    "CostRevenueChargesSid" SERIAL NOT NULL,
    "TransactionSid" INTEGER,
    "MenuMasterSid" INTEGER NOT NULL,
    "ShipmentNo" VARCHAR,
    "MasterJobNo" VARCHAR,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "SerialNumber" DECIMAL(3,0),
    "ChargeMasterSid" INTEGER,
    "ChargeDescription" VARCHAR(100),
    "ChargeUomSid" INTEGER,
    "PrepaidCollect" VARCHAR(10) DEFAULT 'Prepaid',
    "CostRevenue" VARCHAR(10),
    "CurrencyMasterSid" INTEGER,
    "ExchangeRate" DECIMAL(6,3),
    "Rate" DECIMAL(15,3),
    "NumberOfUnit" DECIMAL(4,3),
    "DrCr" CHAR(1),
    "Amount" DECIMAL(15,3),
    "LocalAmount" DECIMAL(15,3),
    "CustomerMasterSid" INTEGER,
    "CustomerBranchSid" INTEGER,
    "VoucherHeaderSid" INTEGER,
    "VoucherTypeSid" INTEGER,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(100),

    CONSTRAINT "CostRevenueCharges_pkey" PRIMARY KEY ("CostRevenueChargesSid")
);

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_ChargeMasterSid_fkey" FOREIGN KEY ("ChargeMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;
