/*
  Warnings:

  - You are about to drop the column `EnquiryRouteSid` on the `EnquiryProduct` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "EnquiryProduct" DROP CONSTRAINT "EnquiryProduct_EnquiryRouteSid_fkey";

-- AlterTable
ALTER TABLE "EnquiryHeader" ADD COLUMN     "Carrier" INTEGER,
ADD COLUMN     "FreightPPCC" VARCHAR(10) DEFAULT 'Prepaid',
ADD COLUMN     "LeadOrCustomer" VARCHAR(1),
ADD COLUMN     "PreCustomerMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "EnquiryProduct" DROP COLUMN "EnquiryRouteSid",
ADD COLUMN     "ChargeableWeight" DECIMAL(9,3),
ADD COLUMN     "EnquiryCargoSid" INTEGER,
ADD COLUMN     "ExternalPkg" INTEGER,
ADD COLUMN     "ExternalQty" INTEGER,
ADD COLUMN     "GrossWeight" DECIMAL(9,3),
ADD COLUMN     "Height" INTEGER,
ADD COLUMN     "ImcoClass" INTEGER,
ADD COLUMN     "IsHaz" CHAR(1),
ADD COLUMN     "Length" INTEGER,
ADD COLUMN     "NetWeight" DECIMAL(9,3),
ADD COLUMN     "PkgGroup" INTEGER,
ADD COLUMN     "Volume" DECIMAL(9,3),
ADD COLUMN     "Width" INTEGER;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_PreCustomerMasterSid_fkey" FOREIGN KEY ("PreCustomerMasterSid") REFERENCES "PreCustomerMaster"("PreCustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryProduct" ADD CONSTRAINT "EnquiryProduct_EnquiryCargoSid_fkey" FOREIGN KEY ("EnquiryCargoSid") REFERENCES "EnquiryCargo"("EnquiryCargoSid") ON DELETE SET NULL ON UPDATE CASCADE;
