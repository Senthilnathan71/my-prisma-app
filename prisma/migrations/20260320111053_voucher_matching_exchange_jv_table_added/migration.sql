-- AlterTable
ALTER TABLE "MasterJobVoyage" ADD COLUMN     "CreatedBy" VARCHAR(100),
ADD COLUMN     "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "UpdatedBy" VARCHAR(100),
ADD COLUMN     "UpdatedOn" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "VoucherHeader" ALTER COLUMN "CreatedOn" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "UpdatedOn" DROP DEFAULT,
ALTER COLUMN "UpdatedOn" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "VoucherMatchingHeader" ALTER COLUMN "CreatedOn" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "UpdatedOn" DROP DEFAULT,
ALTER COLUMN "UpdatedOn" SET DATA TYPE TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "VoucherMatchingExchangeJV" (
    "VoucherMatchingExchangeJVSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherMatchingHeaderSid" INTEGER NOT NULL,
    "ExchangeJVHeaderSid" INTEGER NOT NULL,

    CONSTRAINT "VoucherMatchingExchangeJV_pkey" PRIMARY KEY ("VoucherMatchingExchangeJVSid")
);

-- CreateIndex
CREATE INDEX "idx_vm_exjv_main" ON "VoucherMatchingExchangeJV"("VoucherMatchingHeaderSid", "ExchangeJVHeaderSid", "CompanyMasterSid", "BranchMasterSid", "Status");

-- CreateIndex
CREATE INDEX "idx_crc_txn_menu_company_branch_status" ON "CostRevenueCharges"("TransactionSid", "MenuMasterSid", "CompanyMasterSid", "BranchMasterSid", "status");

-- AddForeignKey
ALTER TABLE "VoucherMatchingExchangeJV" ADD CONSTRAINT "VoucherMatchingExchangeJV_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatchingExchangeJV" ADD CONSTRAINT "VoucherMatchingExchangeJV_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatchingExchangeJV" ADD CONSTRAINT "VoucherMatchingExchangeJV_VoucherMatchingHeaderSid_fkey" FOREIGN KEY ("VoucherMatchingHeaderSid") REFERENCES "VoucherMatchingHeader"("VoucherMatchingHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatchingExchangeJV" ADD CONSTRAINT "VoucherMatchingExchangeJV_ExchangeJVHeaderSid_fkey" FOREIGN KEY ("ExchangeJVHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
