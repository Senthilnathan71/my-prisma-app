/*
  Warnings:

  - You are about to alter the column `TaxPercentage1` on the `VoucherDetail` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `Decimal(5,3)`.
  - You are about to alter the column `TaxPercentage2` on the `VoucherDetail` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `Decimal(5,3)`.

*/
-- AlterTable
ALTER TABLE "TariffDetail" ALTER COLUMN "EffectiveDate" SET DATA TYPE DATE,
ALTER COLUMN "ExpiredOn" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "VoucherDetail" ALTER COLUMN "ExchangeRate" SET DATA TYPE DECIMAL(8,5),
ALTER COLUMN "TaxPercentage1" SET DATA TYPE DECIMAL(5,3),
ALTER COLUMN "TaxPercentage2" SET DATA TYPE DECIMAL(5,3);

-- AlterTable
ALTER TABLE "VoucherHeader" ALTER COLUMN "VoucherDate" SET DATA TYPE DATE;
