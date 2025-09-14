/*
  Warnings:

  - You are about to drop the column `RevnueExchangeRate` on the `BookingRates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BookingRates" DROP COLUMN "RevnueExchangeRate",
ADD COLUMN     "RevenueExchangeRate" DECIMAL(6,3);
