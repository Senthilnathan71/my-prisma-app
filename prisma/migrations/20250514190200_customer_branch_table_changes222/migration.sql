-- DropForeignKey
ALTER TABLE "CusBranchContact" DROP CONSTRAINT "CusBranchContact_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CustomerBrEmail" DROP CONSTRAINT "CustomerBrEmail_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CustomerBrEmail" DROP CONSTRAINT "CustomerBrEmail_MenuMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CustomerLogin" DROP CONSTRAINT "CustomerLogin_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CustomerSalesTeam" DROP CONSTRAINT "CustomerSalesTeam_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "CusBranchContact" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomerBrEmail" ALTER COLUMN "MenuMasterSid" DROP NOT NULL,
ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomerLogin" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomerSalesTeam" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CusBranchContact" ADD CONSTRAINT "CusBranchContact_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBrEmail" ADD CONSTRAINT "CustomerBrEmail_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBrEmail" ADD CONSTRAINT "CustomerBrEmail_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLogin" ADD CONSTRAINT "CustomerLogin_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
