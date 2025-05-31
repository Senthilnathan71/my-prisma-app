/*
  Warnings:

  - You are about to drop the column `AWBCurrencyCode` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `AWBCurrencyName` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `ISO3DigitCode` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `LocalCurrencyCode` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `LocalCurrencyName` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `Remarks` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `ShortName` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `UNM49Code` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `dialingCode` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `CountryMaster` table. All the data in the column will be lost.
  - You are about to drop the column `CountryMasterSid` on the `CurrencyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `currencyFirstName` on the `CurrencyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `currencyID` on the `CurrencyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `currencyLastName` on the `CurrencyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `currencyRatio` on the `CurrencyMaster` table. All the data in the column will be lost.
  - You are about to drop the column `ChargeMasterSid` on the `TariffDetail` table. All the data in the column will be lost.
  - You are about to drop the column `CurrencyMasterSid` on the `TariffDetail` table. All the data in the column will be lost.
  - You are about to drop the column `CargoType` on the `TariffHeader` table. All the data in the column will be lost.
  - You are about to drop the column `ServiceLevel` on the `TariffHeader` table. All the data in the column will be lost.
  - Added the required column `TariffHeaderSid` to the `TariffDetail` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CurrencyMaster" DROP CONSTRAINT "CurrencyMaster_CountryMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "TariffDetail" DROP CONSTRAINT "TariffDetail_ChargeMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "TariffDetail" DROP CONSTRAINT "TariffDetail_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "TariffHeader" DROP CONSTRAINT "TariffHeader_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "CountryMaster" DROP COLUMN "AWBCurrencyCode",
DROP COLUMN "AWBCurrencyName",
DROP COLUMN "ISO3DigitCode",
DROP COLUMN "LocalCurrencyCode",
DROP COLUMN "LocalCurrencyName",
DROP COLUMN "Remarks",
DROP COLUMN "ShortName",
DROP COLUMN "UNM49Code",
DROP COLUMN "dialingCode",
DROP COLUMN "region",
ADD COLUMN     "CurrencyMasterSid" INTEGER,
ADD COLUMN     "ZoneMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "CurrencyMaster" DROP COLUMN "CountryMasterSid",
DROP COLUMN "currencyFirstName",
DROP COLUMN "currencyID",
DROP COLUMN "currencyLastName",
DROP COLUMN "currencyRatio",
ADD COLUMN     "RoundOf" VARCHAR(100);

-- AlterTable
ALTER TABLE "DepartmentMaster" ADD COLUMN     "Division" VARCHAR(20),
ADD COLUMN     "Remarks" VARCHAR(20);

-- AlterTable
ALTER TABLE "TariffDetail" DROP COLUMN "ChargeMasterSid",
DROP COLUMN "CurrencyMasterSid",
ADD COLUMN     "TariffHeaderSid" INTEGER NOT NULL,
ALTER COLUMN "Description" DROP NOT NULL,
ALTER COLUMN "SlabFrom" DROP NOT NULL,
ALTER COLUMN "SlabTo" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL,
ALTER COLUMN "CompanyMasterSid" DROP NOT NULL,
ALTER COLUMN "EffectiveDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TariffHeader" DROP COLUMN "CargoType",
DROP COLUMN "ServiceLevel",
ADD COLUMN     "MovementType" VARCHAR(10),
ALTER COLUMN "CompanyMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CountryMaster" ADD CONSTRAINT "CountryMaster_ZoneMasterSid_fkey" FOREIGN KEY ("ZoneMasterSid") REFERENCES "ZoneMaster"("ZoneMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountryMaster" ADD CONSTRAINT "CountryMaster_CurrencyMasterSid_fkey" FOREIGN KEY ("CurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffDetail" ADD CONSTRAINT "TariffDetail_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffDetail" ADD CONSTRAINT "TariffDetail_TariffHeaderSid_fkey" FOREIGN KEY ("TariffHeaderSid") REFERENCES "TariffHeader"("TariffHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
