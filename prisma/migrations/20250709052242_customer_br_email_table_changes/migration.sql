/*
  Warnings:

  - The `DepartmentMasterSid` column on the `CustomerBrEmail` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "CustomerBrEmail" DROP CONSTRAINT "CustomerBrEmail_DepartmentMasterSid_fkey";

-- AlterTable
ALTER TABLE "CustomerBrEmail" DROP COLUMN "DepartmentMasterSid",
ADD COLUMN     "DepartmentMasterSid" TEXT[];
