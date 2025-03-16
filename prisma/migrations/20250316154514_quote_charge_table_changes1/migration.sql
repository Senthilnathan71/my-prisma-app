/*
  Warnings:

  - You are about to alter the column `costCurrency` on the `QuoteCharge` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - You are about to alter the column `costUnit` on the `QuoteCharge` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.

*/
-- AlterTable
ALTER TABLE "QuoteCharge" ALTER COLUMN "costCurrency" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "costUnit" SET DATA TYPE VARCHAR(10);
