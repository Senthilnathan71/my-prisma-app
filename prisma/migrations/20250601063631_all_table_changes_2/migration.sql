/*
  Warnings:

  - You are about to drop the column `Carrier` on the `VoyageMasterDetail` table. All the data in the column will be lost.
  - You are about to drop the column `CoLoad` on the `VoyageMasterDetail` table. All the data in the column will be lost.
  - You are about to drop the column `IFMDate` on the `VoyageMasterDetail` table. All the data in the column will be lost.
  - You are about to drop the column `Sno` on the `VoyageMasterDetail` table. All the data in the column will be lost.
  - You are about to drop the column `VoyageType` on the `VoyageMasterDetail` table. All the data in the column will be lost.
  - Added the required column `CompanyMasterSid` to the `ChargeGroup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `GroupName` to the `ChargeGroup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Remarks` to the `ChargeGroup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `HSNSAC` to the `ChargeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `TDSMasterSid` to the `ChargeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Module` to the `RoleMenuMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Remarks` to the `RoleMenuMaster` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BranchMaster" DROP CONSTRAINT "BranchMaster_CurrencyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_ChargeGroupSid_fkey";

-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_CurrencyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_CityMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_CurrencyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "ContainerTypeMaster" DROP CONSTRAINT "ContainerTypeMaster_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CurrencyExchange" DROP CONSTRAINT "CurrencyExchange_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CurrencyExchange" DROP CONSTRAINT "CurrencyExchange_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "DivisionMaster" DROP CONSTRAINT "DivisionMaster_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "ProductMaster" DROP CONSTRAINT "ProductMaster_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "ProductMaster" DROP CONSTRAINT "ProductMaster_CustomerMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "RoleMaster" DROP CONSTRAINT "RoleMaster_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "RoleMenuMaster" DROP CONSTRAINT "RoleMenuMaster_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "BranchBank" ALTER COLUMN "BankCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BranchMaster" ALTER COLUMN "CurrencyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChargeGroup" ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "GroupName" VARCHAR(100) NOT NULL,
ADD COLUMN     "Remarks" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "ChargeMaster" ADD COLUMN     "HSNSAC" VARCHAR(100) NOT NULL,
ADD COLUMN     "TDSMasterSid" INTEGER NOT NULL,
ALTER COLUMN "UOM" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL,
ALTER COLUMN "ChargeGroupSid" DROP NOT NULL,
ALTER COLUMN "CurrencyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CompanyMaster" ADD COLUMN     "Pan" VARCHAR(20),
ALTER COLUMN "postal_code" DROP NOT NULL,
ALTER COLUMN "CityMasterSid" DROP NOT NULL,
ALTER COLUMN "CurrencyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ContainerTypeMaster" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CurrencyExchange" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL,
ALTER COLUMN "BranchMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomerBranch" ADD COLUMN     "Branch_Code" VARCHAR(20),
ADD COLUMN     "Branch_Type" VARCHAR(20),
ADD COLUMN     "Contact_Person" VARCHAR(20);

-- AlterTable
ALTER TABLE "DivisionMaster" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "HSSACMaster" ALTER COLUMN "HSSACName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PortMaster" ADD COLUMN     "ZoneMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "ProductMaster" ALTER COLUMN "CustomerMasterSid" DROP NOT NULL,
ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RoleMaster" ADD COLUMN     "LicenseType" VARCHAR(50),
ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RoleMenuMaster" ADD COLUMN     "Module" VARCHAR(50) NOT NULL,
ADD COLUMN     "Remarks" VARCHAR(100) NOT NULL,
ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SectorMaster" ADD COLUMN     "RegionCode" VARCHAR(10),
ADD COLUMN     "RegionName" VARCHAR(50);

-- AlterTable
ALTER TABLE "VoyageMasterDetail" DROP COLUMN "Carrier",
DROP COLUMN "CoLoad",
DROP COLUMN "IFMDate",
DROP COLUMN "Sno",
DROP COLUMN "VoyageType",
ADD COLUMN     "IGMDate" TIMESTAMP(3),
ALTER COLUMN "Coloader" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VoyageMasterHeader" ADD COLUMN     "Carrier" INTEGER,
ADD COLUMN     "CoLoad" CHAR(1) DEFAULT 'N',
ADD COLUMN     "VoyageType" VARCHAR(10),
ALTER COLUMN "ViaNumber" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_CityMasterSid_fkey" FOREIGN KEY ("CityMasterSid") REFERENCES "CityMaster"("CityMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyExchange" ADD CONSTRAINT "CurrencyExchange_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionMaster" ADD CONSTRAINT "DivisionMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortMaster" ADD CONSTRAINT "PortMaster_ZoneMasterSid_fkey" FOREIGN KEY ("ZoneMasterSid") REFERENCES "ZoneMaster"("ZoneMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_ChargeGroupSid_fkey" FOREIGN KEY ("ChargeGroupSid") REFERENCES "ChargeGroup"("ChargeGroupSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_TDSMasterSid_fkey" FOREIGN KEY ("TDSMasterSid") REFERENCES "TDSSetHeader"("TDSSetHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeGroup" ADD CONSTRAINT "ChargeGroup_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerTypeMaster" ADD CONSTRAINT "ContainerTypeMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMaster" ADD CONSTRAINT "RoleMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuMaster" ADD CONSTRAINT "RoleMenuMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
