-- AddForeignKey
ALTER TABLE "CustomerBrEmail" ADD CONSTRAINT "CustomerBrEmail_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
