-- AlterTable
ALTER TABLE "DepartmentMaster" ADD COLUMN     "CostCOAMasterSid" INTEGER,
ADD COLUMN     "RevenueCOAMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "DepartmentMaster" ADD CONSTRAINT "DepartmentMaster_CostCOAMasterSid_fkey" FOREIGN KEY ("CostCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMaster" ADD CONSTRAINT "DepartmentMaster_RevenueCOAMasterSid_fkey" FOREIGN KEY ("RevenueCOAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
