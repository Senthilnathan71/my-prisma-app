-- AlterTable
ALTER TABLE "ActivityResourceAllocation" ADD COLUMN     "MenuMasterSid" INTEGER,
ADD COLUMN     "TransactionSid" INTEGER;

-- AlterTable
ALTER TABLE "BookingOthers" ADD COLUMN     "ResourcePerson" INTEGER;

-- AlterTable
ALTER TABLE "EnquiryOther" ADD COLUMN     "ResourcePerson" INTEGER;

-- AlterTable
ALTER TABLE "HouseJobOthers" ADD COLUMN     "ResourcePerson" INTEGER;

-- AlterTable
ALTER TABLE "MasterJobOthers" ADD COLUMN     "ResourcePerson" INTEGER;

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "ResourcePerson" INTEGER;

-- AlterTable
ALTER TABLE "ResourceConfiguration" ADD COLUMN     "MenuMasterSid" INTEGER,
ADD COLUMN     "TransactionSid" INTEGER;

-- AddForeignKey
ALTER TABLE "BookingOthers" ADD CONSTRAINT "BookingOthers_ResourcePerson_fkey" FOREIGN KEY ("ResourcePerson") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceConfiguration" ADD CONSTRAINT "ResourceConfiguration_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_ResourcePerson_fkey" FOREIGN KEY ("ResourcePerson") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryOther" ADD CONSTRAINT "EnquiryOther_ResourcePerson_fkey" FOREIGN KEY ("ResourcePerson") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterJobOthers" ADD CONSTRAINT "MasterJobOthers_ResourcePerson_fkey" FOREIGN KEY ("ResourcePerson") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobOthers" ADD CONSTRAINT "HouseJobOthers_ResourcePerson_fkey" FOREIGN KEY ("ResourcePerson") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
