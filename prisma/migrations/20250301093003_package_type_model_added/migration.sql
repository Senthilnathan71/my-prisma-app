/*
  Warnings:

  - The primary key for the `CustomerMaster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `EnquiryCargoSid` on the `CustomerMaster` table. All the data in the column will be lost.
  - Made the column `ShipmentExpectedDate` on table `EnquiryHeader` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CustomerMaster" DROP CONSTRAINT "CustomerMaster_pkey",
DROP COLUMN "EnquiryCargoSid",
ADD COLUMN     "CustomerMasterSid" SERIAL NOT NULL,
ADD CONSTRAINT "CustomerMaster_pkey" PRIMARY KEY ("CustomerMasterSid");

-- AlterTable
ALTER TABLE "EnquiryCargo" ALTER COLUMN "WeightUnitSid" DROP NOT NULL,
ALTER COLUMN "NetWeight" DROP NOT NULL,
ALTER COLUMN "ChargeableWeight" DROP NOT NULL,
ALTER COLUMN "ContainerType" DROP NOT NULL,
ALTER COLUMN "ShipmentTerms" DROP NOT NULL,
ALTER COLUMN "ProductName" DROP NOT NULL,
ALTER COLUMN "PackageType" DROP NOT NULL,
ALTER COLUMN "PackageQty" DROP NOT NULL,
ALTER COLUMN "CargoDescription" DROP NOT NULL,
ALTER COLUMN "updatedOn" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "EnquiryHeader" ALTER COLUMN "EnquiryDate" DROP NOT NULL,
ALTER COLUMN "CustomerAddress" DROP NOT NULL,
ALTER COLUMN "EnquiryType" DROP NOT NULL,
ALTER COLUMN "EnquiryBy" DROP NOT NULL,
ALTER COLUMN "ShipmentExpectedDate" SET NOT NULL,
ALTER COLUMN "ClearanceBy" DROP NOT NULL,
ALTER COLUMN "TransportBy" DROP NOT NULL,
ALTER COLUMN "DestinationClearance" DROP NOT NULL,
ALTER COLUMN "DestinationTransport" DROP NOT NULL,
ALTER COLUMN "RoutingNo" DROP NOT NULL,
ALTER COLUMN "ShipperRef" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL,
ALTER COLUMN "Email" DROP NOT NULL,
ALTER COLUMN "updatedOn" DROP NOT NULL,
ALTER COLUMN "createdBy" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- CreateTable
CREATE TABLE "PackageTypeMaster" (
    "PackageTypeMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "PackageName" VARCHAR(100) NOT NULL,
    "PackageCode" VARCHAR(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "PackageTypeMaster_pkey" PRIMARY KEY ("PackageTypeMasterSid")
);

-- AddForeignKey
ALTER TABLE "PackageTypeMaster" ADD CONSTRAINT "PackageTypeMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
