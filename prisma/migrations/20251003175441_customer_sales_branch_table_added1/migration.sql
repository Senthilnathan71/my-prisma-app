/*
  Warnings:

  - You are about to drop the column `CustomerSalesBranchSid` on the `CustomerSalesTeam` table. All the data in the column will be lost.
  - You are about to drop the `CustomerSalesBranch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomerSalesBranch" DROP CONSTRAINT "CustomerSalesBranch_CustomerBranchSid_fkey";

-- DropForeignKey
ALTER TABLE "CustomerSalesBranch" DROP CONSTRAINT "CustomerSalesBranch_CustomerSalesSid_fkey";

-- AlterTable
ALTER TABLE "CustomerSalesTeam" DROP COLUMN "CustomerSalesBranchSid",
ADD COLUMN     "CustomerBranchSid" INTEGER;

-- DropTable
DROP TABLE "CustomerSalesBranch";

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;
