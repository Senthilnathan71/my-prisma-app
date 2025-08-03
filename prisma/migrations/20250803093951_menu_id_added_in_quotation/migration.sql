-- AlterTable
ALTER TABLE "BookingConnection" ALTER COLUMN "Remarks" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "MenuMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "EnquiryHeader" ADD COLUMN     "MenuMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "MenuMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "VesselMaster" ALTER COLUMN "Remarks" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VoyageMasterHeader" ALTER COLUMN "Remarks" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FieldConfiguration" (
    "configSid" SERIAL NOT NULL,
    "fieldConfig" JSONB NOT NULL,

    CONSTRAINT "FieldConfiguration_pkey" PRIMARY KEY ("configSid")
);

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
