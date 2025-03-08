/*
  Warnings:

  - Added the required column `QuoteNumber` to the `QuoteHeader` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "QuoteNumber" VARCHAR(200) NOT NULL,
ALTER COLUMN "QuoteValidFrom" DROP NOT NULL,
ALTER COLUMN "QuoteValidTo" DROP NOT NULL,
ALTER COLUMN "RoutingHeaderSid" DROP NOT NULL;
