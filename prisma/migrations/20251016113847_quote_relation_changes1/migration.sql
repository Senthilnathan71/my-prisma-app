/*
  Warnings:

  - A unique constraint covering the columns `[QuoteHeaderSid]` on the table `EnquiryHeader` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "QuoteHeader" DROP CONSTRAINT "QuoteHeader_EnquirySid_fkey";

-- AlterTable
ALTER TABLE "EnquiryHeader" ADD COLUMN     "QuoteHeaderSid" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryHeader_QuoteHeaderSid_key" ON "EnquiryHeader"("QuoteHeaderSid");

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_QuoteHeaderSid_fkey" FOREIGN KEY ("QuoteHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
