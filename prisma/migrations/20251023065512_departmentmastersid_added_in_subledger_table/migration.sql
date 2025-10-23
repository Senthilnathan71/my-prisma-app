-- DropForeignKey
ALTER TABLE "SubledgerMaster" DROP CONSTRAINT "SubledgerMaster_COAMasterSid_fkey";

-- AlterTable
ALTER TABLE "SubledgerMaster" ADD COLUMN     "DepartmentMasterSid" INTEGER,
ALTER COLUMN "COAMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SubledgerMaster" ADD CONSTRAINT "SubledgerMaster_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubledgerMaster" ADD CONSTRAINT "SubledgerMaster_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
