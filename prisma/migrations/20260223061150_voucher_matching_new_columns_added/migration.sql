-- AlterTable
ALTER TABLE "MatchingDetail" ADD COLUMN     "MatchingType" VARCHAR(10);

-- AlterTable
ALTER TABLE "VoucherMatchingHeader" ADD COLUMN     "PostDate" DATE,
ADD COLUMN     "PostStatus" CHAR(1) NOT NULL DEFAULT 'U';
