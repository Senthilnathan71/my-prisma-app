/*
  Warnings:

  - The `CertificateAmt` column on the `SupplierTdsMapping` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "SupplierTdsMapping" ALTER COLUMN "CompanyType" SET DATA TYPE VARCHAR(50),
DROP COLUMN "CertificateAmt",
ADD COLUMN     "CertificateAmt" DECIMAL(15,3);
