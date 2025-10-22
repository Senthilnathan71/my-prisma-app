-- AlterTable
ALTER TABLE "EnquiryHeader" ADD COLUMN     "ContactNumber" VARCHAR(20),
ADD COLUMN     "ContactPerson" VARCHAR(20);

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "ContactNumber" VARCHAR(20),
ADD COLUMN     "ContactPerson" VARCHAR(20);

-- AlterTable
ALTER TABLE "SubledgerMaster" ADD COLUMN     "AccrualCOAMasterSid" INTEGER,
ADD COLUMN     "CrCOAMasterSid" INTEGER,
ADD COLUMN     "DrCOAMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "SubledgerMaster" ADD CONSTRAINT "SubledgerMaster_DrCOAMasterSid_fkey" FOREIGN KEY ("DrCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubledgerMaster" ADD CONSTRAINT "SubledgerMaster_CrCOAMasterSid_fkey" FOREIGN KEY ("CrCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubledgerMaster" ADD CONSTRAINT "SubledgerMaster_AccrualCOAMasterSid_fkey" FOREIGN KEY ("AccrualCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
