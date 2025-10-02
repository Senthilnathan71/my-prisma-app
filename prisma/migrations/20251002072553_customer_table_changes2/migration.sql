/*
  Warnings:

  - The `DepartmentMasterSid` column on the `CustomerBrEmail` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `DepartmentMasterSid` column on the `CustomerSalesTeam` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CustomerBrEmail" DROP COLUMN "DepartmentMasterSid",
ADD COLUMN     "DepartmentMasterSid" TEXT[];

-- AlterTable
ALTER TABLE "CustomerSalesTeam" DROP COLUMN "DepartmentMasterSid",
ADD COLUMN     "DepartmentMasterSid" TEXT[];
