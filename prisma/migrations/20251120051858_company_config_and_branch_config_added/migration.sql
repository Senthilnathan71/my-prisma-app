-- AlterTable
ALTER TABLE "BLClauseMaster" ALTER COLUMN "Keyword" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "MasterJobContainer" ADD COLUMN     "MarksandNumber" VARCHAR(200);

-- AlterTable
ALTER TABLE "QuoteCharge" ADD COLUMN     "RateLock" CHAR(1) DEFAULT 'N';

-- CreateTable
CREATE TABLE "CompanyConfiguration" (
    "CompanyConfigurationSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "ConfigurationName" VARCHAR(50) NOT NULL,
    "ConfigurationValue" VARCHAR(200) NOT NULL,

    CONSTRAINT "CompanyConfiguration_pkey" PRIMARY KEY ("CompanyConfigurationSid")
);

-- CreateTable
CREATE TABLE "BranchConfiguration" (
    "BranchConfigurationSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "ConfigurationName" VARCHAR(50) NOT NULL,
    "ConfigurationValue" VARCHAR(200) NOT NULL,

    CONSTRAINT "BranchConfiguration_pkey" PRIMARY KEY ("BranchConfigurationSid")
);

-- CreateIndex
CREATE INDEX "CompanyConfiguration_CompanyMasterSid_idx" ON "CompanyConfiguration"("CompanyMasterSid");

-- CreateIndex
CREATE INDEX "BranchConfiguration_CompanyMasterSid_idx" ON "BranchConfiguration"("CompanyMasterSid");

-- CreateIndex
CREATE INDEX "BranchConfiguration_BranchMasterSid_idx" ON "BranchConfiguration"("BranchMasterSid");

-- AddForeignKey
ALTER TABLE "CompanyConfiguration" ADD CONSTRAINT "CompanyConfiguration_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchConfiguration" ADD CONSTRAINT "BranchConfiguration_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchConfiguration" ADD CONSTRAINT "BranchConfiguration_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
