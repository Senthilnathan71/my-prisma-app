/*
  Warnings:

  - You are about to drop the column `ReveueNumberOfUnit` on the `BookingRates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BookingRates" DROP COLUMN "ReveueNumberOfUnit",
ADD COLUMN     "RevenueNumberOfUnit" DECIMAL(4,3);
