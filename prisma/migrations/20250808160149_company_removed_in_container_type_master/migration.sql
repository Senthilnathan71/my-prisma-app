/*
  Warnings:

  - You are about to drop the column `CompanyMasterSid` on the `ContainerTypeMaster` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ContainerTypeMaster" DROP CONSTRAINT "ContainerTypeMaster_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "ContainerTypeMaster" DROP COLUMN "CompanyMasterSid";
