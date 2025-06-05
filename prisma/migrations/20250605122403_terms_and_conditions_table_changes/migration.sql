-- DropForeignKey
ALTER TABLE "TermsAndConditionsMaster" DROP CONSTRAINT "TermsAndConditionsMaster_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "TermsAndConditionsMaster" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL,
ALTER COLUMN "PrintType" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TermsAndConditionsMaster" ADD CONSTRAINT "TermsAndConditionsMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
