-- AlterTable
ALTER TABLE "COAMaster" ADD COLUMN     "InterBranchLocation" INTEGER;

-- AlterTable
ALTER TABLE "MatchingDetail" ADD COLUMN     "AllotmentBranchSid" INTEGER;

-- CreateTable
CREATE TABLE "VoucherInterBranch" (
    "VoucherInterBranchSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherHeaderSid" INTEGER NOT NULL,
    "AllotmentBranchSid" INTEGER NOT NULL,
    "CurrencyAmount" DECIMAL(15,3) NOT NULL,
    "LocalAmount" DECIMAL(15,3) NOT NULL,
    "SourceJVHeaderSid" INTEGER,
    "InterBranchVoucherSid" INTEGER,

    CONSTRAINT "VoucherInterBranch_pkey" PRIMARY KEY ("VoucherInterBranchSid")
);

-- CreateIndex
CREATE INDEX "VoucherInterBranch_CompanyMasterSid_BranchMasterSid_Voucher_idx" ON "VoucherInterBranch"("CompanyMasterSid", "BranchMasterSid", "VoucherHeaderSid");

-- CreateIndex
CREATE INDEX "VoucherInterBranch_VoucherHeaderSid_AllotmentBranchSid_idx" ON "VoucherInterBranch"("VoucherHeaderSid", "AllotmentBranchSid");

-- CreateIndex
CREATE INDEX "VoucherInterBranch_AllotmentBranchSid_idx" ON "VoucherInterBranch"("AllotmentBranchSid");

-- AddForeignKey
ALTER TABLE "COAMaster" ADD CONSTRAINT "COAMaster_InterBranchLocation_fkey" FOREIGN KEY ("InterBranchLocation") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherInterBranch" ADD CONSTRAINT "VoucherInterBranch_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherInterBranch" ADD CONSTRAINT "VoucherInterBranch_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherInterBranch" ADD CONSTRAINT "VoucherInterBranch_AllotmentBranchSid_fkey" FOREIGN KEY ("AllotmentBranchSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherInterBranch" ADD CONSTRAINT "VoucherInterBranch_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherInterBranch" ADD CONSTRAINT "VoucherInterBranch_SourceJVHeaderSid_fkey" FOREIGN KEY ("SourceJVHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherInterBranch" ADD CONSTRAINT "VoucherInterBranch_InterBranchVoucherSid_fkey" FOREIGN KEY ("InterBranchVoucherSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
