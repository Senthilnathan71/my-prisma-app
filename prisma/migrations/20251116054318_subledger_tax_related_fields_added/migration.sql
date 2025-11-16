-- AlterTable
ALTER TABLE "SubledgerMaster" ADD COLUMN     "TaxCode" VARCHAR(10),
ADD COLUMN     "TaxGroup" INTEGER,
ADD COLUMN     "TaxType" VARCHAR(6);
