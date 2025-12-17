/*
  Warnings:

  - You are about to drop the column `InsuranceAmount` on the `MasterJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `ValuationCharge` on the `MasterJobOthers` table. All the data in the column will be lost.
  - You are about to drop the column `ValueForInsurance` on the `MasterJobOthers` table. All the data in the column will be lost.
  - You are about to alter the column `SellExchangeRate` on the `MasterJobOthers` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,4)`.
  - You are about to alter the column `AgentExchangeRate` on the `MasterJobOthers` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,4)`.
  - The `DepartmentMasterSid` column on the `MilestoneMaster` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "MilestoneMaster" DROP CONSTRAINT "MilestoneMaster_DepartmentMasterSid_fkey";

-- AlterTable
ALTER TABLE "HouseJobOthers" ADD COLUMN     "HandlingInformation" VARCHAR(300),
ADD COLUMN     "InsuranceAmount" DECIMAL(12,3),
ADD COLUMN     "ValuationCharge" DECIMAL(12,3),
ADD COLUMN     "ValueForInsurance" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "MasterJobOthers" DROP COLUMN "InsuranceAmount",
DROP COLUMN "ValuationCharge",
DROP COLUMN "ValueForInsurance",
ALTER COLUMN "SellExchangeRate" SET DATA TYPE DECIMAL(8,4),
ALTER COLUMN "AgentExchangeRate" SET DATA TYPE DECIMAL(8,4);

-- AlterTable
ALTER TABLE "MilestoneMaster" DROP COLUMN "DepartmentMasterSid",
ADD COLUMN     "DepartmentMasterSid" TEXT[];
