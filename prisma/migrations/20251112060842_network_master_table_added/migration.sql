-- DropForeignKey
ALTER TABLE "VoucherTransaction" DROP CONSTRAINT "VoucherTransaction_COAMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherTransaction" DROP CONSTRAINT "VoucherTransaction_DepartmentMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherTransaction" DROP CONSTRAINT "VoucherTransaction_HouseJobSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherTransaction" DROP CONSTRAINT "VoucherTransaction_LedgerMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "VoucherTransaction" DROP CONSTRAINT "VoucherTransaction_MasterJobSid_fkey";

-- AlterTable
ALTER TABLE "VoucherMatching" ADD COLUMN     "MatchingTransactionSid" INTEGER;

-- AlterTable
ALTER TABLE "VoucherTransaction" ADD COLUMN     "ChargeMasterSid" INTEGER,
ALTER COLUMN "ChargeDescription" DROP NOT NULL,
ALTER COLUMN "LedgerMasterSid" DROP NOT NULL,
ALTER COLUMN "COAMasterSid" DROP NOT NULL,
ALTER COLUMN "DepartmentMasterSid" DROP NOT NULL,
ALTER COLUMN "HouseJobSid" DROP NOT NULL,
ALTER COLUMN "MasterJobSid" DROP NOT NULL,
ALTER COLUMN "CostRevenue" DROP NOT NULL,
ALTER COLUMN "TransType" DROP NOT NULL;

-- CreateTable
CREATE TABLE "NetworkMaster" (
    "NetworkMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "NetworkName" VARCHAR(100) NOT NULL,
    "CountrySid" INTEGER NOT NULL,
    "NetworkType" VARCHAR(10) NOT NULL DEFAULT 'Forwarders',

    CONSTRAINT "NetworkMaster_pkey" PRIMARY KEY ("NetworkMasterSid")
);

-- CreateIndex
CREATE INDEX "network_company" ON "NetworkMaster"("CompanyMasterSid");

-- CreateIndex
CREATE INDEX "network_country" ON "NetworkMaster"("CountrySid");

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_ChargeMasterSid_fkey" FOREIGN KEY ("ChargeMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_LedgerMasterSid_fkey" FOREIGN KEY ("LedgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTransaction" ADD CONSTRAINT "VoucherTransaction_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMaster" ADD CONSTRAINT "NetworkMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMaster" ADD CONSTRAINT "NetworkMaster_CountrySid_fkey" FOREIGN KEY ("CountrySid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
