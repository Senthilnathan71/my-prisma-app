-- DropForeignKey
ALTER TABLE "BranchMaster" DROP CONSTRAINT "BranchMaster_CountryMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_CountryMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CustomerMaster" DROP CONSTRAINT "CustomerMaster_CountryMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "PortMaster" DROP CONSTRAINT "PortMaster_CountryMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMaster" DROP CONSTRAINT "PreCustomerMaster_CountryMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "TDSSetRate" DROP CONSTRAINT "TDSSetRate_CountryMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "UserMaster" DROP CONSTRAINT "UserMaster_CountryMasterSid_fkey";

-- AlterTable
ALTER TABLE "BranchMaster" ALTER COLUMN "CountryMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CompanyMaster" ALTER COLUMN "CountryMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomerMaster" ALTER COLUMN "CountryMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PortMaster" ALTER COLUMN "CountryMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PreCustomerMaster" ALTER COLUMN "CountryMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TDSSetRate" ALTER COLUMN "CountryMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserMaster" ALTER COLUMN "CountryMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortMaster" ADD CONSTRAINT "PortMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMaster" ADD CONSTRAINT "CustomerMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDSSetRate" ADD CONSTRAINT "TDSSetRate_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
