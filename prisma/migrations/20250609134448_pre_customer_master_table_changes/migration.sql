-- DropForeignKey
ALTER TABLE "PreCustomerMaster" DROP CONSTRAINT "PreCustomerMaster_BranchMasterSid_fkey";

-- AlterTable
ALTER TABLE "PreCustomerMaster" ADD COLUMN     "AnnualRevenue" INTEGER,
ADD COLUMN     "CompanySize" INTEGER,
ADD COLUMN     "Industry" VARCHAR(100),
ADD COLUMN     "LanguagePreferrence" VARCHAR(100),
ADD COLUMN     "Notes" VARCHAR(100),
ADD COLUMN     "POBOX" VARCHAR(100),
ADD COLUMN     "PreferredContactMode" VARCHAR(100),
ADD COLUMN     "PurchaseTimeline" VARCHAR(100),
ADD COLUMN     "ServiceOfInterest" VARCHAR(100),
ADD COLUMN     "SpecificRequirements" VARCHAR(100),
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "leadAssignTo" DROP NOT NULL,
ALTER COLUMN "BranchMasterSid" DROP NOT NULL,
ALTER COLUMN "preCustomerName" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
