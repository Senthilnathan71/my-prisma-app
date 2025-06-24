/*
  Warnings:

  - You are about to drop the column `VoucherTypeCode` on the `DocumentTypeMaster` table. All the data in the column will be lost.
  - You are about to drop the column `VoucherTypeName` on the `DocumentTypeMaster` table. All the data in the column will be lost.
  - Added the required column `CurrencyCode` to the `DocumentTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DocumentSLNoLength` to the `DocumentTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DocumentSeparator` to the `DocumentTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DocumentStartingNo` to the `DocumentTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DocumentTypeCode` to the `DocumentTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DocumentTypeName` to the `DocumentTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ResetValue` to the `DocumentTypeMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DocumentTypeMaster" DROP COLUMN "VoucherTypeCode",
DROP COLUMN "VoucherTypeName",
ADD COLUMN     "BranchFlag" CHAR(1) NOT NULL DEFAULT 'N',
ADD COLUMN     "BranchValue" CHAR(3),
ADD COLUMN     "COAGroup" INTEGER,
ADD COLUMN     "COALedger" INTEGER,
ADD COLUMN     "COASubgroup" INTEGER,
ADD COLUMN     "CompanyFlag" CHAR(1) NOT NULL DEFAULT 'N',
ADD COLUMN     "CompanyValue" CHAR(3),
ADD COLUMN     "CurrencyCode" VARCHAR(3) NOT NULL,
ADD COLUMN     "DocumentFlag" CHAR(1) NOT NULL DEFAULT 'N',
ADD COLUMN     "DocumentSLNoLength" DECIMAL(2,0) NOT NULL,
ADD COLUMN     "DocumentSeparator" CHAR(1) NOT NULL,
ADD COLUMN     "DocumentStartingNo" DECIMAL(5,0) NOT NULL,
ADD COLUMN     "DocumentTypeCode" VARCHAR(5) NOT NULL,
ADD COLUMN     "DocumentTypeName" VARCHAR(30) NOT NULL,
ADD COLUMN     "DocumentValue" CHAR(3),
ADD COLUMN     "MonthFlag" CHAR(1) NOT NULL DEFAULT 'N',
ADD COLUMN     "ResetValue" VARCHAR(15) NOT NULL,
ADD COLUMN     "Subledger" INTEGER,
ADD COLUMN     "YearFlag" CHAR(1) NOT NULL DEFAULT 'N';
