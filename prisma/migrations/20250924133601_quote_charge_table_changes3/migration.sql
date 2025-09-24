-- DropForeignKey
ALTER TABLE "QuoteCharge" DROP CONSTRAINT "QuoteCharge_CustomerMasterSid_fkey";

-- AlterTable
ALTER TABLE "QuoteCharge" ALTER COLUMN "CustomerMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
