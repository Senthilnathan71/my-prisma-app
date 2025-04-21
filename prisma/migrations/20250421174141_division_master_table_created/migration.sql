-- AlterTable
ALTER TABLE "CurrencyMaster" ADD COLUMN     "CurrencySubUnit" VARCHAR(50),
ADD COLUMN     "CurrencyUnit" VARCHAR(50),
ADD COLUMN     "ShortCode" CHAR(3),
ADD COLUMN     "Symbol" CHAR(1),
ALTER COLUMN "status" SET DEFAULT 'A';

-- CreateTable
CREATE TABLE "CurrencyExchange" (
    "CurrencyExchangeSid" SERIAL NOT NULL,
    "EffectiveFrom" TIMESTAMP(3) NOT NULL,
    "FromCurrency" VARCHAR(3) NOT NULL,
    "ToCurrency" VARCHAR(3) NOT NULL,
    "SellRate" DECIMAL(6,5) NOT NULL,
    "BuyRate" DECIMAL(6,5) NOT NULL,
    "BankName" VARCHAR(50) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) NOT NULL,
    "Remarks" VARCHAR(100),

    CONSTRAINT "CurrencyExchange_pkey" PRIMARY KEY ("CurrencyExchangeSid")
);

-- CreateTable
CREATE TABLE "DivisionMaster" (
    "DivisionMasterSid" SERIAL NOT NULL,
    "DivisionName" VARCHAR(50) NOT NULL,
    "DivisionCode" CHAR(3) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) NOT NULL,
    "Remarks" VARCHAR(100),

    CONSTRAINT "DivisionMaster_pkey" PRIMARY KEY ("DivisionMasterSid")
);

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionMaster" ADD CONSTRAINT "DivisionMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
