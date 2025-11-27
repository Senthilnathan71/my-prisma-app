-- AlterTable
ALTER TABLE "MasterJobOthers" ADD COLUMN     "AMSRefNo" VARCHAR(20);

-- AlterTable
ALTER TABLE "MatchingDetail" ADD COLUMN     "MatchingCurrency" INTEGER,
ADD COLUMN     "MatchingExRate" DECIMAL(4,3),
ADD COLUMN     "MatchingTDSAmount" DECIMAL(15,3),
ALTER COLUMN "MatchingAmount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VoucherTransaction" ADD COLUMN     "IsReversed" CHAR(1) DEFAULT 'N';

-- CreateTable
CREATE TABLE "BookingCro" (
    "BookingCroSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "BookingHeaderSid" INTEGER NOT NULL,
    "OnHireRef" VARCHAR(20),
    "ReleaseOrderDate" TIMESTAMP(3),
    "ValidityDate" TIMESTAMP(3),
    "Transporter" VARCHAR(50),
    "EmptyYard" VARCHAR(200),
    "NoteToYard" VARCHAR(200),
    "NoteToShipper" VARCHAR(200),

    CONSTRAINT "BookingCro_pkey" PRIMARY KEY ("BookingCroSid")
);

-- CreateIndex
CREATE INDEX "BookingCro_CompanyMasterSid_idx" ON "BookingCro"("CompanyMasterSid");

-- CreateIndex
CREATE INDEX "BookingCro_BranchMasterSid_idx" ON "BookingCro"("BranchMasterSid");

-- CreateIndex
CREATE INDEX "BookingCro_BookingHeaderSid_idx" ON "BookingCro"("BookingHeaderSid");

-- AddForeignKey
ALTER TABLE "BookingCro" ADD CONSTRAINT "BookingCro_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCro" ADD CONSTRAINT "BookingCro_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCro" ADD CONSTRAINT "BookingCro_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingDetail" ADD CONSTRAINT "MatchingDetail_MatchingCurrency_fkey" FOREIGN KEY ("MatchingCurrency") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
