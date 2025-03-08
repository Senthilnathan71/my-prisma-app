/*
  Warnings:

  - You are about to drop the column `CreatedBy` on the `QuoteCarrier` table. All the data in the column will be lost.
  - You are about to drop the column `CreatedOn` on the `QuoteCarrier` table. All the data in the column will be lost.
  - You are about to drop the column `LoginSid` on the `QuoteCarrier` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedBy` on the `QuoteCarrier` table. All the data in the column will be lost.
  - You are about to drop the column `UpdatedOn` on the `QuoteCarrier` table. All the data in the column will be lost.
  - You are about to drop the column `LoginSid` on the `QuoteHeader` table. All the data in the column will be lost.
  - You are about to drop the column `RoutingSid` on the `QuoteHeader` table. All the data in the column will be lost.
  - You are about to drop the column `LoginSid` on the `QuoteRoute` table. All the data in the column will be lost.
  - Added the required column `RoutingHeaderSid` to the `QuoteHeader` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "QuoteHeader" DROP CONSTRAINT "QuoteHeader_EnquirySid_fkey";

-- AlterTable
ALTER TABLE "QuoteCarrier" DROP COLUMN "CreatedBy",
DROP COLUMN "CreatedOn",
DROP COLUMN "LoginSid",
DROP COLUMN "UpdatedBy",
DROP COLUMN "UpdatedOn";

-- AlterTable
ALTER TABLE "QuoteHeader" DROP COLUMN "LoginSid",
DROP COLUMN "RoutingSid",
ADD COLUMN     "RoutingHeaderSid" INTEGER NOT NULL,
ALTER COLUMN "EnquirySid" DROP NOT NULL,
ALTER COLUMN "AgentMasterSid" DROP NOT NULL,
ALTER COLUMN "AgentName" DROP NOT NULL,
ALTER COLUMN "AgentAddress" DROP NOT NULL,
ALTER COLUMN "SalesmanSid" DROP NOT NULL,
ALTER COLUMN "QuoteSource" DROP NOT NULL,
ALTER COLUMN "IncoTerms" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL,
ALTER COLUMN "EnquiryRemarks" DROP NOT NULL,
ALTER COLUMN "ShipperRefNo" DROP NOT NULL,
ALTER COLUMN "TransportType" DROP NOT NULL,
ALTER COLUMN "CustomerRef" DROP NOT NULL,
ALTER COLUMN "InternalApprovedBy" DROP NOT NULL,
ALTER COLUMN "InternalApprovedOn" DROP NOT NULL,
ALTER COLUMN "CustomerApprovedBy" DROP NOT NULL,
ALTER COLUMN "CustomerApprovedOn" DROP NOT NULL,
ALTER COLUMN "Email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "QuoteRoute" DROP COLUMN "LoginSid",
ALTER COLUMN "CargoType" DROP NOT NULL,
ALTER COLUMN "POLFreeDays" DROP NOT NULL,
ALTER COLUMN "PODFreeDays" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL,
ALTER COLUMN "IsHaz" DROP NOT NULL,
ALTER COLUMN "ServiceLevel" DROP NOT NULL,
ALTER COLUMN "TransitDays" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_EnquirySid_fkey" FOREIGN KEY ("EnquirySid") REFERENCES "EnquiryHeader"("EnquiryHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
