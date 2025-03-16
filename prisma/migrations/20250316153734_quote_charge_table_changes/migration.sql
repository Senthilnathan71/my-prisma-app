-- AlterTable
ALTER TABLE "QuoteCharge" ADD COLUMN     "costCurrency" INTEGER,
ADD COLUMN     "costPerUnit" INTEGER,
ADD COLUMN     "costUnit" INTEGER,
ADD COLUMN     "perUnit" INTEGER,
ALTER COLUMN "fortyft" DROP NOT NULL,
ALTER COLUMN "twentyft" DROP NOT NULL;
