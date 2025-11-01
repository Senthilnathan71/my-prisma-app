-- CreateTable
CREATE TABLE "VoucherMatchingHeader" (
    "VoucherMatchingHeaderSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherMatchingNo" VARCHAR(20) NOT NULL,
    "VoucherMatchingDate" TIMESTAMP(3) NOT NULL,
    "Narration" VARCHAR(100),
    "Remarks" VARCHAR(100),

    CONSTRAINT "VoucherMatchingHeader_pkey" PRIMARY KEY ("VoucherMatchingHeaderSid")
);

-- CreateTable
CREATE TABLE "VoucherMatching" (
    "VoucherMatchingSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherMatchingHeaderSid" INTEGER NOT NULL,
    "VoucherHeaderSid" INTEGER NOT NULL,
    "VoucherDetailSid" INTEGER NOT NULL,
    "VoucherTransactionSid" INTEGER NOT NULL,
    "VoucherMatchingDate" TIMESTAMP(3) NOT NULL,
    "VoucherType" INTEGER NOT NULL,
    "Sno" DECIMAL(4,0) NOT NULL,
    "COAMasterSid" INTEGER,
    "CurrencyCode" VARCHAR(3) NOT NULL,
    "ExchangeRate" DECIMAL(6,3) NOT NULL,
    "DrCr" CHAR(1) NOT NULL,
    "Amount" DECIMAL(15,3) NOT NULL,
    "LocalAmount" DECIMAL(15,3) NOT NULL,
    "MatchingType" VARCHAR(10) NOT NULL,

    CONSTRAINT "VoucherMatching_pkey" PRIMARY KEY ("VoucherMatchingSid")
);

-- AddForeignKey
ALTER TABLE "VoucherMatchingHeader" ADD CONSTRAINT "VoucherMatchingHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatchingHeader" ADD CONSTRAINT "VoucherMatchingHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatching" ADD CONSTRAINT "VoucherMatching_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatching" ADD CONSTRAINT "VoucherMatching_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatching" ADD CONSTRAINT "VoucherMatching_VoucherDetailSid_fkey" FOREIGN KEY ("VoucherDetailSid") REFERENCES "VoucherDetail"("VoucherDetailSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatching" ADD CONSTRAINT "VoucherMatching_VoucherTransactionSid_fkey" FOREIGN KEY ("VoucherTransactionSid") REFERENCES "VoucherTransaction"("VoucherTransactionSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatching" ADD CONSTRAINT "VoucherMatching_VoucherMatchingHeaderSid_fkey" FOREIGN KEY ("VoucherMatchingHeaderSid") REFERENCES "VoucherMatchingHeader"("VoucherMatchingHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatching" ADD CONSTRAINT "VoucherMatching_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherMatching" ADD CONSTRAINT "VoucherMatching_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
