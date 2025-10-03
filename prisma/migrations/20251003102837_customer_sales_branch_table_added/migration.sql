/*
  Warnings:

  - You are about to drop the column `CustomerBranchSid` on the `CustomerSalesTeam` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomerSalesTeam" DROP CONSTRAINT "CustomerSalesTeam_CustomerBranchSid_fkey";

-- AlterTable
ALTER TABLE "CustomerSalesTeam" DROP COLUMN "CustomerBranchSid",
ADD COLUMN     "CustomerSalesBranchSid" INTEGER;

-- CreateTable
CREATE TABLE "CustomerSalesBranch" (
    "CustomerSalesBranchSid" SERIAL NOT NULL,
    "CustomerSalesSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER NOT NULL,

    CONSTRAINT "CustomerSalesBranch_pkey" PRIMARY KEY ("CustomerSalesBranchSid")
);

-- AddForeignKey
ALTER TABLE "CustomerSalesBranch" ADD CONSTRAINT "CustomerSalesBranch_CustomerSalesSid_fkey" FOREIGN KEY ("CustomerSalesSid") REFERENCES "CustomerSalesTeam"("CustomerSalesSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesBranch" ADD CONSTRAINT "CustomerSalesBranch_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;
