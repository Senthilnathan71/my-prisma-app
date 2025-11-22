-- CreateTable
CREATE TABLE "MatchingDetail" (
    "MatchingDetailSid" SERIAL NOT NULL,
    "Sno" DECIMAL(4,0) NOT NULL,
    "BranchName" VARCHAR(20),
    "VoucherHeaderSid" INTEGER NOT NULL,
    "VoucherDetailSid" INTEGER NOT NULL,
    "VoucherTransactionSid" INTEGER NOT NULL,
    "VoucherType" CHAR(4) NOT NULL,
    "CurrencyCode" VARCHAR(3) NOT NULL,
    "ExchangeRate" DECIMAL(6,3) NOT NULL,
    "DrCr" CHAR(1) NOT NULL,
    "Amount" DECIMAL(15,3) NOT NULL,
    "LocalAmount" DECIMAL(15,3) NOT NULL,
    "MatchingAmount" DECIMAL(15,3) NOT NULL,
    "MatchingLocalAmount" DECIMAL(15,3) NOT NULL,
    "SourceVoucherHeaderSid" INTEGER NOT NULL,
    "VoucherMatchingHeaderSid" INTEGER NOT NULL,

    CONSTRAINT "MatchingDetail_pkey" PRIMARY KEY ("MatchingDetailSid")
);

-- CreateIndex
CREATE INDEX "MatchingDetail_VoucherHeaderSid_idx" ON "MatchingDetail"("VoucherHeaderSid");

-- CreateIndex
CREATE INDEX "MatchingDetail_VoucherTransactionSid_idx" ON "MatchingDetail"("VoucherTransactionSid");

-- CreateIndex
CREATE INDEX "MatchingDetail_SourceVoucherHeaderSid_idx" ON "MatchingDetail"("SourceVoucherHeaderSid");

-- CreateIndex
CREATE INDEX "MatchingDetail_VoucherMatchingHeaderSid_idx" ON "MatchingDetail"("VoucherMatchingHeaderSid");

-- AddForeignKey
ALTER TABLE "MatchingDetail" ADD CONSTRAINT "MatchingDetail_SourceVoucherHeaderSid_fkey" FOREIGN KEY ("SourceVoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingDetail" ADD CONSTRAINT "MatchingDetail_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingDetail" ADD CONSTRAINT "MatchingDetail_VoucherTransactionSid_fkey" FOREIGN KEY ("VoucherTransactionSid") REFERENCES "VoucherTransaction"("VoucherTransactionSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingDetail" ADD CONSTRAINT "MatchingDetail_VoucherMatchingHeaderSid_fkey" FOREIGN KEY ("VoucherMatchingHeaderSid") REFERENCES "VoucherMatchingHeader"("VoucherMatchingHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
