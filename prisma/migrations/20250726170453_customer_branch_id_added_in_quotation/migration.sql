-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "CustomerBranchSid" INTEGER;

-- AlterTable
ALTER TABLE "EnquiryHeader" ADD COLUMN     "CustomerBranchSid" INTEGER;

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "CustomerBranchSid" INTEGER;

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;
