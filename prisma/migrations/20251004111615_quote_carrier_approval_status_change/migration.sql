/*
  Warnings:

  - The `ApprovalStatus` column on the `QuoteCarrier` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "CountryMaster" DROP CONSTRAINT "CountryMaster_CurrencyMasterSid_fkey";

-- AlterTable
ALTER TABLE "QuoteCarrier" DROP COLUMN "ApprovalStatus",
ADD COLUMN     "ApprovalStatus" "ApprovalStatus" DEFAULT 'Pending';

-- AddForeignKey
ALTER TABLE "CurrencyMaster" ADD CONSTRAINT "CurrencyMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
