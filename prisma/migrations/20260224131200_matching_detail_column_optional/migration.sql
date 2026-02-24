-- DropForeignKey
ALTER TABLE "MatchingDetail" DROP CONSTRAINT "MatchingDetail_SourceVoucherHeaderSid_fkey";

-- AlterTable
ALTER TABLE "MatchingDetail" ALTER COLUMN "SourceVoucherHeaderSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MatchingDetail" ADD CONSTRAINT "MatchingDetail_SourceVoucherHeaderSid_fkey" FOREIGN KEY ("SourceVoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
