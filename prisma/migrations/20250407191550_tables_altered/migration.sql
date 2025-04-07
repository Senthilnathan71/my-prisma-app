/*
  Warnings:

  - Added the required column `AWBCurrencyCode` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `AWBCurrencyName` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ISO3DigitCode` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `LocalCurrencyCode` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `LocalCurrencyName` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ShortName` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `UNM49Code` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dialingCode` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `CountryMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `StateMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zone` to the `StateMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CountryMaster" ADD COLUMN     "AWBCurrencyCode" VARCHAR(10),
ADD COLUMN     "AWBCurrencyName" VARCHAR(100),
ADD COLUMN     "ISO3DigitCode" VARCHAR(10),
ADD COLUMN     "LocalCurrencyCode" VARCHAR(10),
ADD COLUMN     "LocalCurrencyName" VARCHAR(100),
ADD COLUMN     "Remarks" VARCHAR(100),
ADD COLUMN     "ShortName" VARCHAR(100),
ADD COLUMN     "UNM49Code" VARCHAR(10),
ADD COLUMN     "dialingCode" VARCHAR(10),
ADD COLUMN     "region" VARCHAR(100);

-- AlterTable
ALTER TABLE "StateMaster" ADD COLUMN     "Remarks" VARCHAR(100),
ADD COLUMN     "region" VARCHAR(100),
ADD COLUMN     "zone" INTEGER;
