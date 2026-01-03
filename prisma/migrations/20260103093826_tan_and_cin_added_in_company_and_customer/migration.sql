-- DropForeignKey
ALTER TABLE "VoucherHeader" DROP CONSTRAINT "VoucherHeader_COAMasterSid_fkey";

-- AlterTable
ALTER TABLE "CompanyMaster" ADD COLUMN     "CIN" VARCHAR(25),
ADD COLUMN     "TAN" VARCHAR(25);

-- AlterTable
ALTER TABLE "CustomerMaster" ADD COLUMN     "CIN" VARCHAR(25),
ADD COLUMN     "TAN" VARCHAR(25);

-- AlterTable
ALTER TABLE "EnquiryCargo" ADD COLUMN     "Volumetric" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "QuoteProduct" ADD COLUMN     "Volumetric" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "VoucherHeader" ALTER COLUMN "COAMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_COAMasterSid_fkey" FOREIGN KEY ("COAMasterSid") REFERENCES "COAMaster"("COAMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
