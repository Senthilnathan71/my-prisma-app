/*
  Warnings:

  - You are about to drop the column `CompanyType` on the `CustomerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `PanVatNo` on the `CustomerMaster` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomerMaster" DROP CONSTRAINT "CustomerMaster_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CustomerMaster" DROP CONSTRAINT "CustomerMaster_PreCustomerMasterSid_fkey";

-- AlterTable
ALTER TABLE "CustomerMaster" DROP COLUMN "CompanyType",
DROP COLUMN "PanVatNo",
ADD COLUMN     "CustomerType" JSONB,
ADD COLUMN     "PanType" VARCHAR(20),
ALTER COLUMN "CompanyMasterSid" DROP NOT NULL,
ALTER COLUMN "PreCustomerMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CustomerMaster" ADD CONSTRAINT "CustomerMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMaster" ADD CONSTRAINT "CustomerMaster_PreCustomerMasterSid_fkey" FOREIGN KEY ("PreCustomerMasterSid") REFERENCES "PreCustomerMaster"("PreCustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
