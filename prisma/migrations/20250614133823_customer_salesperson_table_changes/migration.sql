/*
  Warnings:

  - The `DepartmentMasterSid` column on the `CustomerSalesTeam` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "CustomerSalesTeam" DROP CONSTRAINT "CustomerSalesTeam_DepartmentMasterSid_fkey";

-- AlterTable
ALTER TABLE "CustomerSalesTeam" DROP COLUMN "DepartmentMasterSid",
ADD COLUMN     "DepartmentMasterSid" TEXT[];
