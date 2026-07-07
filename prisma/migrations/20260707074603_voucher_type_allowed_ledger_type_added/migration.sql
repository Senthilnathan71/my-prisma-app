/*
  Warnings:

  - You are about to drop the column `IsMandatory` on the `ShipmentMilestone` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MilestoneMaster" ADD COLUMN     "IsMandatory" CHAR(1) NOT NULL DEFAULT 'N';

-- AlterTable
ALTER TABLE "ShipmentMilestone" DROP COLUMN "IsMandatory";

-- AlterTable
ALTER TABLE "VoucherTypeMaster" ADD COLUMN     "AllowedLedgerTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
