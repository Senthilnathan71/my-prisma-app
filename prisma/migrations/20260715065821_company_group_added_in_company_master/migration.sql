-- AlterTable
ALTER TABLE "CompanyMaster" ADD COLUMN     "CompanyGroup" VARCHAR(100);

-- AlterTable
ALTER TABLE "UserMaster" ADD COLUMN     "SalesCompany" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
