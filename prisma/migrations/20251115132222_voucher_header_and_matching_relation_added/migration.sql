/*
  Warnings:

  - You are about to drop the column `branchMasterBranchMasterSid` on the `HouseJobBOE` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "HouseJobBOE" DROP CONSTRAINT "HouseJobBOE_branchMasterBranchMasterSid_fkey";

-- AlterTable
ALTER TABLE "HouseJobBOE" DROP COLUMN "branchMasterBranchMasterSid";

-- AlterTable
ALTER TABLE "VoucherMatchingHeader" ADD COLUMN     "VoucherHeaderSid" INTEGER;

-- AddForeignKey
ALTER TABLE "VoucherMatchingHeader" ADD CONSTRAINT "VoucherMatchingHeader_VoucherHeaderSid_fkey" FOREIGN KEY ("VoucherHeaderSid") REFERENCES "VoucherHeader"("VoucherHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
