-- DropForeignKey
ALTER TABLE "VoyageMasterDetail" DROP CONSTRAINT "VoyageMasterDetail_PODSid_fkey";

-- AlterTable
ALTER TABLE "ChargeTaxMaster" ADD COLUMN     "chargeTaxMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "VoyageMasterDetail" ALTER COLUMN "PODSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "VoyageMasterDetail" ADD CONSTRAINT "VoyageMasterDetail_PODSid_fkey" FOREIGN KEY ("PODSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeTaxMaster" ADD CONSTRAINT "ChargeTaxMaster_chargeTaxMasterSid_fkey" FOREIGN KEY ("chargeTaxMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
