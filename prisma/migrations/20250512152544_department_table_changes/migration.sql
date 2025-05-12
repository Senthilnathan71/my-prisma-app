-- DropForeignKey
ALTER TABLE "DepartmentMaster" DROP CONSTRAINT "DepartmentMaster_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "DepartmentMaster" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DepartmentMaster" ADD CONSTRAINT "DepartmentMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
