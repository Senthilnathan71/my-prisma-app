/*
  Warnings:

  - You are about to drop the column `CustomerBranchSid` on the `CustomerSalesTeam` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserTypeCode" ADD VALUE 'csPerson';
ALTER TYPE "UserTypeCode" ADD VALUE 'docPerson';

-- DropForeignKey
ALTER TABLE "CustomerSalesTeam" DROP CONSTRAINT "CustomerSalesTeam_CustomerBranchSid_fkey";

-- AlterTable
ALTER TABLE "CustomerSalesTeam" DROP COLUMN "CustomerBranchSid";

-- CreateTable
CREATE TABLE "CustomerSalesBranch" (
    "id" SERIAL NOT NULL,
    "customerSalesSid" INTEGER NOT NULL,
    "customerBranchSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),

    CONSTRAINT "CustomerSalesBranch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomerSalesBranch" ADD CONSTRAINT "CustomerSalesBranch_customerSalesSid_fkey" FOREIGN KEY ("customerSalesSid") REFERENCES "CustomerSalesTeam"("CustomerSalesSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesBranch" ADD CONSTRAINT "CustomerSalesBranch_customerBranchSid_fkey" FOREIGN KEY ("customerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;
