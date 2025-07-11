-- AlterTable
ALTER TABLE "IncoMaster" ADD COLUMN     "IncoDescription" VARCHAR(500),
ADD COLUMN     "Remarks" VARCHAR(500);

-- CreateTable
CREATE TABLE "COAMaster" (
    "COAMasterSid" SERIAL NOT NULL,
    "GroupName" VARCHAR(50) NOT NULL,
    "SubGroupName" VARCHAR(50) NOT NULL,
    "LedgerName" VARCHAR(50) NOT NULL,
    "SubledgerName" VARCHAR(100) NOT NULL,
    "LedgerCode" VARCHAR(12) NOT NULL,
    "LedgerType" VARCHAR(20) NOT NULL,
    "LedgerLocation" TEXT[],
    "Ledgername2" VARCHAR(50),
    "LedgerCurrency" INTEGER,
    "JobNoRequire" CHAR(1) NOT NULL DEFAULT 'N',
    "HSNRequire" CHAR(1) NOT NULL DEFAULT 'N',
    "ProfitandLoss" CHAR(1) NOT NULL DEFAULT 'N',
    "BalanceSheet" CHAR(1) NOT NULL DEFAULT 'N',
    "Remarks" VARCHAR(100),
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "CompanyMasterSid" INTEGER NOT NULL,
    "Status" CHAR(1) NOT NULL DEFAULT 'A',

    CONSTRAINT "COAMaster_pkey" PRIMARY KEY ("COAMasterSid")
);

-- AddForeignKey
ALTER TABLE "COAMaster" ADD CONSTRAINT "COAMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAMaster" ADD CONSTRAINT "COAMaster_LedgerCurrency_fkey" FOREIGN KEY ("LedgerCurrency") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
