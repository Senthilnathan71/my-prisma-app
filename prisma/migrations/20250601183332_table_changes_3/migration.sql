/*
  Warnings:

  - Added the required column `MinSale` to the `TariffDetail` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TariffHeader" DROP CONSTRAINT "TariffHeader_AgentSid_fkey";

-- DropForeignKey
ALTER TABLE "TariffHeader" DROP CONSTRAINT "TariffHeader_FDCSid_fkey";

-- DropForeignKey
ALTER TABLE "TariffHeader" DROP CONSTRAINT "TariffHeader_POOSid_fkey";

-- AlterTable
ALTER TABLE "TariffDetail" ADD COLUMN     "ExpiredOn" TIMESTAMP(3),
ADD COLUMN     "MinSale" VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE "TariffHeader" ALTER COLUMN "POOSid" DROP NOT NULL,
ALTER COLUMN "FDCSid" DROP NOT NULL,
ALTER COLUMN "AgentSid" DROP NOT NULL,
ALTER COLUMN "IncoTerms" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UOMMaster" ALTER COLUMN "UOMType" DROP NOT NULL,
ALTER COLUMN "CostPerUnitPrice" DROP NOT NULL,
ALTER COLUMN "SlabFrom" DROP NOT NULL,
ALTER COLUMN "SlabTo" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_POOSid_fkey" FOREIGN KEY ("POOSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_FDCSid_fkey" FOREIGN KEY ("FDCSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_AgentSid_fkey" FOREIGN KEY ("AgentSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
