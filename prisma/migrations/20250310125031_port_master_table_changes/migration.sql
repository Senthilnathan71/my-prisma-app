-- AddForeignKey
ALTER TABLE "PortMaster" ADD CONSTRAINT "PortMaster_SectorMasterSid_fkey" FOREIGN KEY ("SectorMasterSid") REFERENCES "SectorMaster"("SectorMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
