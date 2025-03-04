-- CreateTable
CREATE TABLE "TariffHeader" (
    "TariffHeaderSid" SERIAL NOT NULL,
    "SegmentMasterSid" INTEGER NOT NULL,
    "POOSid" INTEGER NOT NULL,
    "POLSid" INTEGER NOT NULL,
    "PODSid" INTEGER NOT NULL,
    "POLTerminal" VARCHAR(5) NOT NULL,
    "PODTerminal" VARCHAR(5) NOT NULL,
    "ViaPortSid" INTEGER NOT NULL,
    "FDCSid" INTEGER NOT NULL,
    "Carrier" INTEGER NOT NULL,
    "ServiceLevel" VARCHAR(10) NOT NULL,
    "CargoType" VARCHAR(10) NOT NULL,
    "StuffingAt" VARCHAR(10) NOT NULL,
    "EffectiveDate" TIMESTAMP(3) NOT NULL,
    "AgentSid" INTEGER NOT NULL,
    "IncoTerms" VARCHAR(10) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "IsSlabApplicable" CHAR(1) NOT NULL,

    CONSTRAINT "TariffHeader_pkey" PRIMARY KEY ("TariffHeaderSid")
);

-- CreateTable
CREATE TABLE "TariffDetail" (
    "TariffDetailSid" SERIAL NOT NULL,
    "ChargeMasterSid" INTEGER NOT NULL,
    "ChargeCode" VARCHAR(5) NOT NULL,
    "Description" VARCHAR(100) NOT NULL,
    "UOMSid" INTEGER NOT NULL,
    "CurrencyMasterSid" INTEGER NOT NULL,
    "SaleCurrency" INTEGER NOT NULL,
    "SalePerUnitPrice" DECIMAL(10,5) NOT NULL,
    "CostCurrency" INTEGER NOT NULL,
    "CostPerUnitPrice" DECIMAL(10,5) NOT NULL,
    "SlabFrom" DECIMAL(4,0) NOT NULL,
    "SlabTo" DECIMAL(4,0) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(100) NOT NULL,

    CONSTRAINT "TariffDetail_pkey" PRIMARY KEY ("TariffDetailSid")
);

-- AddForeignKey
ALTER TABLE "TariffDetail" ADD CONSTRAINT "TariffDetail_ChargeMasterSid_fkey" FOREIGN KEY ("ChargeMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
