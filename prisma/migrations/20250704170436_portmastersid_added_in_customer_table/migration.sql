-- AlterTable
ALTER TABLE "CustomerMaster" ADD COLUMN     "PortMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "CustomerMaster" ADD CONSTRAINT "CustomerMaster_PortMasterSid_fkey" FOREIGN KEY ("PortMasterSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
