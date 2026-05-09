-- AlterTable
ALTER TABLE "PaymentRequestDetail" ADD COLUMN     "COAMasterSid" INTEGER,
ADD COLUMN     "LedgerMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_LedgerMasterSid_fkey" FOREIGN KEY ("LedgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
