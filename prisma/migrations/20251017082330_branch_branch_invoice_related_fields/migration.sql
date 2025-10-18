-- AlterTable
ALTER TABLE "BranchBank" ADD COLUMN     "CurrencyMasterSid" INTEGER,
ADD COLUMN     "PrintOnInvoice" VARCHAR(1);

-- AddForeignKey
ALTER TABLE "BranchBank" ADD CONSTRAINT "BranchBank_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
