-- DropForeignKey
ALTER TABLE "QuoteHeader" DROP CONSTRAINT "QuoteHeader_DepartmentMasterSid_fkey";

-- AlterTable
ALTER TABLE "QuoteHeader" ALTER COLUMN "DepartmentMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
