-- AddForeignKey
ALTER TABLE "SubledgerMaster" ADD CONSTRAINT "SubledgerMaster_TaxGroup_fkey" FOREIGN KEY ("TaxGroup") REFERENCES "TaxGroup"("TaxGroupSid") ON DELETE SET NULL ON UPDATE CASCADE;
