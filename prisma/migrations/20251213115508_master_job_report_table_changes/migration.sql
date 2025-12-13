-- AlterTable
ALTER TABLE "BLClauseMaster" ADD COLUMN     "DepartmentMasterSid" INTEGER NOT NULL DEFAULT 19;

-- AlterTable
ALTER TABLE "MasterJob" ADD COLUMN     "PortCutoffDate" DATE,
ADD COLUMN     "SiCutoffDate" DATE;

-- AlterTable
ALTER TABLE "MasterJobOthers" ADD COLUMN     "InsuranceAmount" DECIMAL(12,3),
ADD COLUMN     "ValuationCharge" DECIMAL(12,3),
ADD COLUMN     "ValueForInsurance" DECIMAL(12,3);

-- AddForeignKey
ALTER TABLE "BLClauseMaster" ADD CONSTRAINT "BLClauseMaster_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
