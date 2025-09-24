-- AlterTable
ALTER TABLE "PreCustomerMeeting" ADD COLUMN     "meetingDuration" TEXT;

-- AlterTable
ALTER TABLE "VoyageMasterHeader" ADD COLUMN     "ATA" TIMESTAMP(3),
ADD COLUMN     "ATD" TIMESTAMP(3),
ADD COLUMN     "Coloader" INTEGER,
ADD COLUMN     "ETA" TIMESTAMP(3),
ADD COLUMN     "ETD" TIMESTAMP(3),
ADD COLUMN     "PODSid" INTEGER,
ADD COLUMN     "POLSid" INTEGER,
ADD COLUMN     "PortCutoff" TIMESTAMP(3),
ADD COLUMN     "TransitDays" DECIMAL(3,0);

-- AddForeignKey
ALTER TABLE "VoyageMasterHeader" ADD CONSTRAINT "VoyageMasterHeader_PODSid_fkey" FOREIGN KEY ("PODSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageMasterHeader" ADD CONSTRAINT "VoyageMasterHeader_POLSid_fkey" FOREIGN KEY ("POLSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageMasterHeader" ADD CONSTRAINT "VoyageMasterHeader_Carrier_fkey" FOREIGN KEY ("Carrier") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageMasterHeader" ADD CONSTRAINT "VoyageMasterHeader_Coloader_fkey" FOREIGN KEY ("Coloader") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
