/*
  Warnings:

  - You are about to drop the column `UnitMasterSid` on the `QuoteCharge` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "QuoteCharge" DROP CONSTRAINT "QuoteCharge_UnitMasterSid_fkey";

-- AlterTable
ALTER TABLE "QuoteCharge" DROP COLUMN "UnitMasterSid",
ADD COLUMN     "UOMMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_UOMMasterSid_fkey" FOREIGN KEY ("UOMMasterSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
