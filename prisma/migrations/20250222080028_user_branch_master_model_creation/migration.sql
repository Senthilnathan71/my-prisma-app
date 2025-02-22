/*
  Warnings:

  - The primary key for the `BranchMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cityMasterId` on the `BranchMaster` table. All the data in the column will be lost.
  - You are about to drop the column `companyMasterId` on the `BranchMaster` table. All the data in the column will be lost.
  - You are about to drop the column `countryMasterId` on the `BranchMaster` table. All the data in the column will be lost.
  - You are about to drop the column `currencyMasterId` on the `BranchMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `BranchMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `BranchMaster` table. All the data in the column will be lost.
  - You are about to drop the column `stateMasterId` on the `BranchMaster` table. All the data in the column will be lost.
  - The primary key for the `ChargeGroup` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ChargeGroup` table. All the data in the column will be lost.
  - The primary key for the `ChargeMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `chargeGroupId` on the `ChargeMaster` table. All the data in the column will be lost.
  - You are about to drop the column `companyMasterId` on the `ChargeMaster` table. All the data in the column will be lost.
  - You are about to drop the column `currencyMasterId` on the `ChargeMaster` table. All the data in the column will be lost.
  - You are about to drop the column `departmentMasterId` on the `ChargeMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `ChargeMaster` table. All the data in the column will be lost.
  - The primary key for the `ChargeTaxMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `companyMasterId` on the `ChargeTaxMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `ChargeTaxMaster` table. All the data in the column will be lost.
  - The primary key for the `CityMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `countryMasterId` on the `CityMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `CityMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `CityMaster` table. All the data in the column will be lost.
  - You are about to drop the column `stateMasterId` on the `CityMaster` table. All the data in the column will be lost.
  - The primary key for the `CompanyMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cityMasterId` on the `CompanyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `countryMasterId` on the `CompanyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `currencyMasterId` on the `CompanyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `CompanyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `CompanyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `stateMasterId` on the `CompanyMaster` table. All the data in the column will be lost.
  - The primary key for the `CountryMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `CountryMaster` table. All the data in the column will be lost.
  - The primary key for the `CurrencyMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `countryMasterId` on the `CurrencyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `CurrencyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `CurrencyMaster` table. All the data in the column will be lost.
  - The primary key for the `DepartmentMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `companyMasterId` on the `DepartmentMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `DepartmentMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `DepartmentMaster` table. All the data in the column will be lost.
  - The primary key for the `PortMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `countryMasterId` on the `PortMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `PortMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `PortMaster` table. All the data in the column will be lost.
  - You are about to drop the column `stateMasterId` on the `PortMaster` table. All the data in the column will be lost.
  - The primary key for the `PreCustomerMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `branchMasterId` on the `PreCustomerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `cityMasterId` on the `PreCustomerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `companyMasterId` on the `PreCustomerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `countryMasterId` on the `PreCustomerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `PreCustomerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `stateMasterId` on the `PreCustomerMaster` table. All the data in the column will be lost.
  - The primary key for the `PreCustomerMeeting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `branchMasterId` on the `PreCustomerMeeting` table. All the data in the column will be lost.
  - You are about to drop the column `companyMasterId` on the `PreCustomerMeeting` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `PreCustomerMeeting` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `PreCustomerMeeting` table. All the data in the column will be lost.
  - You are about to drop the column `preCustomerMasterId` on the `PreCustomerMeeting` table. All the data in the column will be lost.
  - The primary key for the `SectorMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `SectorMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `SectorMaster` table. All the data in the column will be lost.
  - The primary key for the `StateMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `countryMasterId` on the `StateMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `StateMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `StateMaster` table. All the data in the column will be lost.
  - The primary key for the `UnitMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `UnitMaster` table. All the data in the column will be lost.
  - The primary key for the `UserMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `countryMasterId` on the `UserMaster` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `UserMaster` table. All the data in the column will be lost.
  - You are about to drop the column `loginId` on the `UserMaster` table. All the data in the column will be lost.
  - Added the required column `CityMasterSid` to the `BranchMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyMasterSid` to the `BranchMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CountryMasterSid` to the `BranchMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CurrencyMasterSid` to the `BranchMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `StateMasterSid` to the `BranchMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ChargeGroupSid` to the `ChargeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyMasterSid` to the `ChargeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CurrencyMasterSid` to the `ChargeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DepartmentMasterSid` to the `ChargeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyMasterSid` to the `ChargeTaxMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CountryMasterSid` to the `CityMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `StateMasterSid` to the `CityMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CityMasterSid` to the `CompanyMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CountryMasterSid` to the `CompanyMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CurrencyMasterSid` to the `CompanyMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `StateMasterSid` to the `CompanyMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CountryMasterSid` to the `CurrencyMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyMasterSid` to the `DepartmentMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CountryMasterSid` to the `PortMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `StateMasterSid` to the `PortMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `BranchMasterSid` to the `PreCustomerMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CityMasterSid` to the `PreCustomerMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyMasterSid` to the `PreCustomerMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CountryMasterSid` to the `PreCustomerMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `StateMasterSid` to the `PreCustomerMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preCustomerName` to the `PreCustomerMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `BranchMasterSid` to the `PreCustomerMeeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyMasterSid` to the `PreCustomerMeeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `PreCustomerMasterSid` to the `PreCustomerMeeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CountryMasterSid` to the `StateMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CountryMasterSid` to the `UserMaster` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BranchMaster" DROP CONSTRAINT "BranchMaster_cityMasterId_fkey";

-- DropForeignKey
ALTER TABLE "BranchMaster" DROP CONSTRAINT "BranchMaster_companyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "BranchMaster" DROP CONSTRAINT "BranchMaster_countryMasterId_fkey";

-- DropForeignKey
ALTER TABLE "BranchMaster" DROP CONSTRAINT "BranchMaster_currencyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "BranchMaster" DROP CONSTRAINT "BranchMaster_stateMasterId_fkey";

-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_chargeGroupId_fkey";

-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_companyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_currencyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_departmentMasterId_fkey";

-- DropForeignKey
ALTER TABLE "ChargeTaxMaster" DROP CONSTRAINT "ChargeTaxMaster_companyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "CityMaster" DROP CONSTRAINT "CityMaster_countryMasterId_fkey";

-- DropForeignKey
ALTER TABLE "CityMaster" DROP CONSTRAINT "CityMaster_stateMasterId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_cityMasterId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_countryMasterId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_currencyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_stateMasterId_fkey";

-- DropForeignKey
ALTER TABLE "CurrencyMaster" DROP CONSTRAINT "CurrencyMaster_countryMasterId_fkey";

-- DropForeignKey
ALTER TABLE "DepartmentMaster" DROP CONSTRAINT "DepartmentMaster_companyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PortMaster" DROP CONSTRAINT "PortMaster_countryMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PortMaster" DROP CONSTRAINT "PortMaster_stateMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMaster" DROP CONSTRAINT "PreCustomerMaster_branchMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMaster" DROP CONSTRAINT "PreCustomerMaster_cityMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMaster" DROP CONSTRAINT "PreCustomerMaster_companyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMaster" DROP CONSTRAINT "PreCustomerMaster_countryMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMaster" DROP CONSTRAINT "PreCustomerMaster_stateMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMeeting" DROP CONSTRAINT "PreCustomerMeeting_branchMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMeeting" DROP CONSTRAINT "PreCustomerMeeting_companyMasterId_fkey";

-- DropForeignKey
ALTER TABLE "PreCustomerMeeting" DROP CONSTRAINT "PreCustomerMeeting_preCustomerMasterId_fkey";

-- DropForeignKey
ALTER TABLE "StateMaster" DROP CONSTRAINT "StateMaster_countryMasterId_fkey";

-- DropForeignKey
ALTER TABLE "UserMaster" DROP CONSTRAINT "UserMaster_countryMasterId_fkey";

-- AlterTable
ALTER TABLE "BranchMaster" DROP CONSTRAINT "BranchMaster_pkey",
DROP COLUMN "cityMasterId",
DROP COLUMN "companyMasterId",
DROP COLUMN "countryMasterId",
DROP COLUMN "currencyMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
DROP COLUMN "stateMasterId",
ADD COLUMN     "BranchMasterSid" SERIAL NOT NULL,
ADD COLUMN     "CityMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CountryMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CurrencyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD COLUMN     "StateMasterSid" INTEGER NOT NULL,
ADD CONSTRAINT "BranchMaster_pkey" PRIMARY KEY ("BranchMasterSid");

-- AlterTable
ALTER TABLE "ChargeGroup" DROP CONSTRAINT "ChargeGroup_pkey",
DROP COLUMN "id",
ADD COLUMN     "ChargeGroupSid" SERIAL NOT NULL,
ADD CONSTRAINT "ChargeGroup_pkey" PRIMARY KEY ("ChargeGroupSid");

-- AlterTable
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_pkey",
DROP COLUMN "chargeGroupId",
DROP COLUMN "companyMasterId",
DROP COLUMN "currencyMasterId",
DROP COLUMN "departmentMasterId",
DROP COLUMN "id",
ADD COLUMN     "ChargeGroupSid" INTEGER NOT NULL,
ADD COLUMN     "ChargeMasterSid" SERIAL NOT NULL,
ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CurrencyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "DepartmentMasterSid" INTEGER NOT NULL,
ADD CONSTRAINT "ChargeMaster_pkey" PRIMARY KEY ("ChargeMasterSid");

-- AlterTable
ALTER TABLE "ChargeTaxMaster" DROP CONSTRAINT "ChargeTaxMaster_pkey",
DROP COLUMN "companyMasterId",
DROP COLUMN "id",
ADD COLUMN     "ChargeTaxMasterSid" SERIAL NOT NULL,
ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD CONSTRAINT "ChargeTaxMaster_pkey" PRIMARY KEY ("ChargeTaxMasterSid");

-- AlterTable
ALTER TABLE "CityMaster" DROP CONSTRAINT "CityMaster_pkey",
DROP COLUMN "countryMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
DROP COLUMN "stateMasterId",
ADD COLUMN     "CityMasterSid" SERIAL NOT NULL,
ADD COLUMN     "CountryMasterSid" INTEGER NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD COLUMN     "StateMasterSid" INTEGER NOT NULL,
ADD CONSTRAINT "CityMaster_pkey" PRIMARY KEY ("CityMasterSid");

-- AlterTable
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_pkey",
DROP COLUMN "cityMasterId",
DROP COLUMN "countryMasterId",
DROP COLUMN "currencyMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
DROP COLUMN "stateMasterId",
ADD COLUMN     "CityMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CompanyMasterSid" SERIAL NOT NULL,
ADD COLUMN     "CountryMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CurrencyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD COLUMN     "StateMasterSid" INTEGER NOT NULL,
ADD CONSTRAINT "CompanyMaster_pkey" PRIMARY KEY ("CompanyMasterSid");

-- AlterTable
ALTER TABLE "CountryMaster" DROP CONSTRAINT "CountryMaster_pkey",
DROP COLUMN "id",
DROP COLUMN "loginId",
ADD COLUMN     "CountryMasterSid" SERIAL NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD CONSTRAINT "CountryMaster_pkey" PRIMARY KEY ("CountryMasterSid");

-- AlterTable
ALTER TABLE "CurrencyMaster" DROP CONSTRAINT "CurrencyMaster_pkey",
DROP COLUMN "countryMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
ADD COLUMN     "CountryMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CurrencyMasterSid" SERIAL NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD CONSTRAINT "CurrencyMaster_pkey" PRIMARY KEY ("CurrencyMasterSid");

-- AlterTable
ALTER TABLE "DepartmentMaster" DROP CONSTRAINT "DepartmentMaster_pkey",
DROP COLUMN "companyMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "DepartmentMasterSid" SERIAL NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD CONSTRAINT "DepartmentMaster_pkey" PRIMARY KEY ("DepartmentMasterSid");

-- AlterTable
ALTER TABLE "PortMaster" DROP CONSTRAINT "PortMaster_pkey",
DROP COLUMN "countryMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
DROP COLUMN "stateMasterId",
ADD COLUMN     "CountryMasterSid" INTEGER NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD COLUMN     "PortMasterSid" SERIAL NOT NULL,
ADD COLUMN     "StateMasterSid" INTEGER NOT NULL,
ADD CONSTRAINT "PortMaster_pkey" PRIMARY KEY ("PortMasterSid");

-- AlterTable
ALTER TABLE "PreCustomerMaster" DROP CONSTRAINT "PreCustomerMaster_pkey",
DROP COLUMN "branchMasterId",
DROP COLUMN "cityMasterId",
DROP COLUMN "companyMasterId",
DROP COLUMN "countryMasterId",
DROP COLUMN "id",
DROP COLUMN "stateMasterId",
ADD COLUMN     "BranchMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CityMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CountryMasterSid" INTEGER NOT NULL,
ADD COLUMN     "PreCustomerMasterSid" SERIAL NOT NULL,
ADD COLUMN     "StateMasterSid" INTEGER NOT NULL,
ADD COLUMN     "preCustomerName" VARCHAR(100) NOT NULL,
ALTER COLUMN "preCustomerAddress2" DROP NOT NULL,
ALTER COLUMN "leadAssignTo" DROP NOT NULL,
ALTER COLUMN "customerType" DROP NOT NULL,
ALTER COLUMN "preCustomerType" DROP NOT NULL,
ALTER COLUMN "panVat" DROP NOT NULL,
ALTER COLUMN "remarks" DROP NOT NULL,
ADD CONSTRAINT "PreCustomerMaster_pkey" PRIMARY KEY ("PreCustomerMasterSid");

-- AlterTable
ALTER TABLE "PreCustomerMeeting" DROP CONSTRAINT "PreCustomerMeeting_pkey",
DROP COLUMN "branchMasterId",
DROP COLUMN "companyMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
DROP COLUMN "preCustomerMasterId",
ADD COLUMN     "BranchMasterSid" INTEGER NOT NULL,
ADD COLUMN     "CompanyMasterSid" INTEGER NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD COLUMN     "PreCustomerMasterSid" INTEGER NOT NULL,
ADD COLUMN     "PreCustomerMeetingSid" SERIAL NOT NULL,
ADD CONSTRAINT "PreCustomerMeeting_pkey" PRIMARY KEY ("PreCustomerMeetingSid");

-- AlterTable
ALTER TABLE "SectorMaster" DROP CONSTRAINT "SectorMaster_pkey",
DROP COLUMN "id",
DROP COLUMN "loginId",
ADD COLUMN     "LoginSid" INTEGER,
ADD COLUMN     "SectorMasterSid" SERIAL NOT NULL,
ADD CONSTRAINT "SectorMaster_pkey" PRIMARY KEY ("SectorMasterSid");

-- AlterTable
ALTER TABLE "StateMaster" DROP CONSTRAINT "StateMaster_pkey",
DROP COLUMN "countryMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
ADD COLUMN     "CountryMasterSid" INTEGER NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD COLUMN     "StateMasterSid" SERIAL NOT NULL,
ADD CONSTRAINT "StateMaster_pkey" PRIMARY KEY ("StateMasterSid");

-- AlterTable
ALTER TABLE "UnitMaster" DROP CONSTRAINT "UnitMaster_pkey",
DROP COLUMN "id",
ADD COLUMN     "UnitMasterSid" SERIAL NOT NULL,
ADD CONSTRAINT "UnitMaster_pkey" PRIMARY KEY ("UnitMasterSid");

-- AlterTable
ALTER TABLE "UserMaster" DROP CONSTRAINT "UserMaster_pkey",
DROP COLUMN "countryMasterId",
DROP COLUMN "id",
DROP COLUMN "loginId",
ADD COLUMN     "CountryMasterSid" INTEGER NOT NULL,
ADD COLUMN     "LoginSid" INTEGER,
ADD COLUMN     "UserMasterSid" SERIAL NOT NULL,
ADD CONSTRAINT "UserMaster_pkey" PRIMARY KEY ("UserMasterSid");

-- CreateTable
CREATE TABLE "UserBranchMaster" (
    "UserBranchMasterSid" SERIAL NOT NULL,
    "UserMasterSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100) NOT NULL,
    "LoginSid" INTEGER,
    "status" CHAR(1) NOT NULL,

    CONSTRAINT "UserBranchMaster_pkey" PRIMARY KEY ("UserBranchMasterSid")
);

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_CityMasterSid_fkey" FOREIGN KEY ("CityMasterSid") REFERENCES "CityMaster"("CityMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_StateMasterSid_fkey" FOREIGN KEY ("StateMasterSid") REFERENCES "StateMaster"("StateMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_CityMasterSid_fkey" FOREIGN KEY ("CityMasterSid") REFERENCES "CityMaster"("CityMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_StateMasterSid_fkey" FOREIGN KEY ("StateMasterSid") REFERENCES "StateMaster"("StateMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchMaster" ADD CONSTRAINT "BranchMaster_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchMaster" ADD CONSTRAINT "UserBranchMaster_UserMasterSid_fkey" FOREIGN KEY ("UserMasterSid") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchMaster" ADD CONSTRAINT "UserBranchMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchMaster" ADD CONSTRAINT "UserBranchMaster_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyMaster" ADD CONSTRAINT "CurrencyMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateMaster" ADD CONSTRAINT "StateMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMaster" ADD CONSTRAINT "CityMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMaster" ADD CONSTRAINT "CityMaster_StateMasterSid_fkey" FOREIGN KEY ("StateMasterSid") REFERENCES "StateMaster"("StateMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMaster" ADD CONSTRAINT "DepartmentMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortMaster" ADD CONSTRAINT "PortMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortMaster" ADD CONSTRAINT "PortMaster_StateMasterSid_fkey" FOREIGN KEY ("StateMasterSid") REFERENCES "StateMaster"("StateMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_ChargeGroupSid_fkey" FOREIGN KEY ("ChargeGroupSid") REFERENCES "ChargeGroup"("ChargeGroupSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeTaxMaster" ADD CONSTRAINT "ChargeTaxMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_CityMasterSid_fkey" FOREIGN KEY ("CityMasterSid") REFERENCES "CityMaster"("CityMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_StateMasterSid_fkey" FOREIGN KEY ("StateMasterSid") REFERENCES "StateMaster"("StateMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMaster" ADD CONSTRAINT "PreCustomerMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMeeting" ADD CONSTRAINT "PreCustomerMeeting_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMeeting" ADD CONSTRAINT "PreCustomerMeeting_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMeeting" ADD CONSTRAINT "PreCustomerMeeting_PreCustomerMasterSid_fkey" FOREIGN KEY ("PreCustomerMasterSid") REFERENCES "PreCustomerMaster"("PreCustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
