-- AddForeignKey
ALTER TABLE "PreCustomerEvent" ADD CONSTRAINT "PreCustomerEvent_EventLeader_fkey" FOREIGN KEY ("EventLeader") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
