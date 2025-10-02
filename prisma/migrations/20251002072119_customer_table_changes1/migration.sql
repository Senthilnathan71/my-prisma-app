/*
  Warnings:

  - The `DepartmentMasterSid` column on the `CustomerBrEmail` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `DepartmentMasterSid` column on the `CustomerSalesTeam` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `CustomerSalesBranch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomerSalesBranch" DROP CONSTRAINT "CustomerSalesBranch_customerBranchSid_fkey";

-- DropForeignKey
ALTER TABLE "CustomerSalesBranch" DROP CONSTRAINT "CustomerSalesBranch_customerSalesSid_fkey";

-- AlterTable
ALTER TABLE "CustomerBrEmail" ADD COLUMN     "CustomerMasterSid" INTEGER,
DROP COLUMN "DepartmentMasterSid",
ADD COLUMN     "DepartmentMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "CustomerMilestone" ADD COLUMN     "CustomerBranchSid" INTEGER;

-- AlterTable
ALTER TABLE "CustomerSalesTeam" ADD COLUMN     "CustomerBranchSid" INTEGER,
DROP COLUMN "DepartmentMasterSid",
ADD COLUMN     "DepartmentMasterSid" INTEGER;

-- DropTable
DROP TABLE "CustomerSalesBranch";

-- AddForeignKey
ALTER TABLE "CustomerBrEmail" ADD CONSTRAINT "CustomerBrEmail_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMilestone" ADD CONSTRAINT "CustomerMilestone_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;
