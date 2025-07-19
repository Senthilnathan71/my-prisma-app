/*
  Warnings:

  - The `DepartmentMasterSid` column on the `ChargeMaster` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_DepartmentMasterSid_fkey";

-- AlterTable
ALTER TABLE "ChargeMaster" DROP COLUMN "DepartmentMasterSid",
ADD COLUMN     "DepartmentMasterSid" TEXT[];

-- AlterTable
ALTER TABLE "SupplierTdsMapping" ADD COLUMN     "CertificateAmt" VARCHAR(500),
ADD COLUMN     "ITSecCode" VARCHAR(20);

-- AlterTable
ALTER TABLE "TDSSetRate" ALTER COLUMN "TDSAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "TDSRate" DROP NOT NULL,
ALTER COLUMN "TDSRate" SET DATA TYPE DECIMAL(8,2);
