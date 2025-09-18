-- AlterTable
ALTER TABLE "HouseJobProduct" ADD COLUMN     "ContainerNo" VARCHAR(11);

-- AlterTable
ALTER TABLE "ShipmentMilestone" ADD COLUMN     "HouseJobSid" INTEGER;

-- AddForeignKey
ALTER TABLE "ShipmentMilestone" ADD CONSTRAINT "ShipmentMilestone_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE SET NULL ON UPDATE CASCADE;
