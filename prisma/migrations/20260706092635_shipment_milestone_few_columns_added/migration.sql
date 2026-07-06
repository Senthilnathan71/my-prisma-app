-- AlterTable
ALTER TABLE "ShipmentMilestone" ADD COLUMN     "IsMandatory" CHAR(1) NOT NULL DEFAULT 'N';

-- AddForeignKey
ALTER TABLE "ShipmentMilestone" ADD CONSTRAINT "ShipmentMilestone_MilestoneMasterSid_fkey" FOREIGN KEY ("MilestoneMasterSid") REFERENCES "MilestoneMaster"("MilestoneMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
