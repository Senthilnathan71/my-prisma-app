-- AlterTable
ALTER TABLE "HouseJobOthers" ADD COLUMN     "DGConfirmationDate" DATE,
ADD COLUMN     "SIConfirmationDate" DATE;

-- AlterTable
ALTER TABLE "TaxGroup" ALTER COLUMN "TaxRate" SET DATA TYPE DECIMAL(6,3);

-- AlterTable
ALTER TABLE "TaxMaster" ALTER COLUMN "TaxRate" SET DATA TYPE DECIMAL(6,3);
