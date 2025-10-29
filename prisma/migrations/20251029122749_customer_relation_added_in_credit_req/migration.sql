-- AddForeignKey
ALTER TABLE "CustomerCreditRequest" ADD CONSTRAINT "CustomerCreditRequest_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
