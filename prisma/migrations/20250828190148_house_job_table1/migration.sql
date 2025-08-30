-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_TsPortSid_fkey" FOREIGN KEY ("TsPortSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
