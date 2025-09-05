-- AddForeignKey
ALTER TABLE "MasterJobContainer" ADD CONSTRAINT "MasterJobContainer_PkgType_fkey" FOREIGN KEY ("PkgType") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
