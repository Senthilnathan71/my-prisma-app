/*
  Warnings:

  - You are about to drop the column `CurrencyExchange` on the `CurrencyMaster` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CurrencyExchange" ADD COLUMN     "RateFrom" VARCHAR(100);

-- AlterTable
ALTER TABLE "CurrencyMaster" DROP COLUMN "CurrencyExchange";
