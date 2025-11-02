-- AlterTable
ALTER TABLE "CustomerKyc" ADD COLUMN     "AttachDocumentGroupSid" INTEGER;

-- AddForeignKey
ALTER TABLE "CustomerKyc" ADD CONSTRAINT "CustomerKyc_AttachDocumentGroupSid_fkey" FOREIGN KEY ("AttachDocumentGroupSid") REFERENCES "AttachDocumentGroup"("AttachDocumentGroupSid") ON DELETE SET NULL ON UPDATE CASCADE;
