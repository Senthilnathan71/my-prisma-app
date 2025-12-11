-- AlterTable
ALTER TABLE "HouseJobProduct" ADD COLUMN     "MasterJobContainerSid" INTEGER;

-- AddForeignKey
ALTER TABLE "HouseJobProduct" ADD CONSTRAINT "HouseJobProduct_MasterJobContainerSid_fkey" FOREIGN KEY ("MasterJobContainerSid") REFERENCES "MasterJobContainer"("MasterJobContainerSid") ON DELETE SET NULL ON UPDATE CASCADE;
