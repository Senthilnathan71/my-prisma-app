/*
  Warnings:

  - A unique constraint covering the columns `[BookingHeaderSid]` on the table `QuoteHeader` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "BookingHeader" DROP CONSTRAINT "BookingHeader_QuotationHeaderSid_fkey";

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "BookingHeaderSid" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "QuoteHeader_BookingHeaderSid_key" ON "QuoteHeader"("BookingHeaderSid");

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
