/*
  Warnings:

  - You are about to drop the column `RateLock` on the `QuoteCharge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "QuoteCharge" DROP COLUMN "RateLock";

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "RateLock" CHAR(1) DEFAULT 'N';
