/*
  Warnings:

  - You are about to drop the column `CompanyMasterSid` on the `TDSSetHeader` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "TDSSetHeader" DROP CONSTRAINT "TDSSetHeader_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "TDSSetHeader" DROP COLUMN "CompanyMasterSid";
