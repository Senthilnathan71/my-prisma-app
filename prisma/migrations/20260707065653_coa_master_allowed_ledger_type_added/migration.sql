-- AlterTable
ALTER TABLE "COAMaster" ADD COLUMN     "AllowedLedgerTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
