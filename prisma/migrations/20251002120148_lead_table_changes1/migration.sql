/*
  Warnings:

  - The `isQualify` column on the `PreCustomerMaster` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "PreCustomerMaster" DROP COLUMN "isQualify",
ADD COLUMN     "isQualify" CHAR(1) DEFAULT 'N';
