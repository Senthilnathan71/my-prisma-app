-- CreateTable
CREATE TABLE "TDSSetHeader" (
    "TDSSetHeaderSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "TDSSetName" VARCHAR(50) NOT NULL,
    "TransactionLimit" DECIMAL(12,3) NOT NULL,
    "AnnualLimit" DECIMAL(12,3) NOT NULL,
    "TDSsetTransactionLimit" DECIMAL(12,3) NOT NULL,
    "TDSSetAnnualLimit" DECIMAL(12,3) NOT NULL,
    "EffectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(200),

    CONSTRAINT "TDSSetHeader_pkey" PRIMARY KEY ("TDSSetHeaderSid")
);

-- CreateTable
CREATE TABLE "TDSSetRate" (
    "TDSSetRateSid" SERIAL NOT NULL,
    "TDSSetHeaderSid" INTEGER NOT NULL,
    "CountryMasterSid" INTEGER NOT NULL,
    "Sno" DECIMAL(2,0),
    "CompanyType" VARCHAR(50) NOT NULL,
    "ITSectionCode" VARCHAR(10) NOT NULL,
    "TDSAmount" DECIMAL(9,0),
    "TDSRate" DECIMAL(2,0) NOT NULL,
    "EffectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(200),

    CONSTRAINT "TDSSetRate_pkey" PRIMARY KEY ("TDSSetRateSid")
);

-- CreateTable
CREATE TABLE "TDSExemption" (
    "TDSExemptionSid" SERIAL NOT NULL,
    "TDSSetHeaderSid" INTEGER NOT NULL,
    "Vessel" INTEGER NOT NULL,
    "Carrier" INTEGER NOT NULL,
    "Transporter" INTEGER NOT NULL,
    "EffectiveFrom" TIMESTAMP(3) NOT NULL,
    "EffectiveTo" TIMESTAMP(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(200),

    CONSTRAINT "TDSExemption_pkey" PRIMARY KEY ("TDSExemptionSid")
);

-- CreateTable
CREATE TABLE "ChargeTaxMapping" (
    "ChargeTaxMappingSid" SERIAL NOT NULL,
    "ChargeMasterSid" INTEGER NOT NULL,
    "HSSACMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "ChargeTaxMapping_pkey" PRIMARY KEY ("ChargeTaxMappingSid")
);

-- CreateTable
CREATE TABLE "ChargeTds" (
    "ChargeTdsSid" SERIAL NOT NULL,
    "ChargeMasterSid" INTEGER NOT NULL,
    "TDSSet" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "ChargeTds_pkey" PRIMARY KEY ("ChargeTdsSid")
);

-- CreateTable
CREATE TABLE "BranchLut" (
    "BranchLutSid" SERIAL NOT NULL,
    "Lut_Valid" TIMESTAMP(3) NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "BranchLut_pkey" PRIMARY KEY ("BranchLutSid")
);

-- AddForeignKey
ALTER TABLE "VoyageMasterDetail" ADD CONSTRAINT "VoyageMasterDetail_POLSid_fkey" FOREIGN KEY ("POLSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageMasterDetail" ADD CONSTRAINT "VoyageMasterDetail_PODSid_fkey" FOREIGN KEY ("PODSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSSetHeader" ADD CONSTRAINT "TDSSetHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSSetRate" ADD CONSTRAINT "TDSSetRate_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSSetRate" ADD CONSTRAINT "TDSSetRate_TDSSetHeaderSid_fkey" FOREIGN KEY ("TDSSetHeaderSid") REFERENCES "TDSSetHeader"("TDSSetHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSExemption" ADD CONSTRAINT "TDSExemption_TDSSetHeaderSid_fkey" FOREIGN KEY ("TDSSetHeaderSid") REFERENCES "TDSSetHeader"("TDSSetHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSExemption" ADD CONSTRAINT "TDSExemption_Vessel_fkey" FOREIGN KEY ("Vessel") REFERENCES "VesselMaster"("VesselMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSExemption" ADD CONSTRAINT "TDSExemption_Carrier_fkey" FOREIGN KEY ("Carrier") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSExemption" ADD CONSTRAINT "TDSExemption_Transporter_fkey" FOREIGN KEY ("Transporter") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeTaxMapping" ADD CONSTRAINT "ChargeTaxMapping_ChargeMasterSid_fkey" FOREIGN KEY ("ChargeMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeTaxMapping" ADD CONSTRAINT "ChargeTaxMapping_HSSACMasterSid_fkey" FOREIGN KEY ("HSSACMasterSid") REFERENCES "HSSACMaster"("HSSACMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeTds" ADD CONSTRAINT "ChargeTds_ChargeMasterSid_fkey" FOREIGN KEY ("ChargeMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeTds" ADD CONSTRAINT "ChargeTds_TDSSet_fkey" FOREIGN KEY ("TDSSet") REFERENCES "TDSSetHeader"("TDSSetHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchLut" ADD CONSTRAINT "BranchLut_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
