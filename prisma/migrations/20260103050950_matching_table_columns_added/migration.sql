-- AlterTable
ALTER TABLE "MatchingDetail" ADD COLUMN     "PartyAmount" DECIMAL(15,3);

-- AlterTable
ALTER TABLE "VoucherMatching" ADD COLUMN     "PartyAmount" DECIMAL(15,3);

-- AlterTable
ALTER TABLE "VoucherTypeMaster" ADD COLUMN     "IsAutoPosting" CHAR(1) DEFAULT 'N';
