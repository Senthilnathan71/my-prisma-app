/*
  Warnings:

  - A unique constraint covering the columns `[BookingNo,CompanyMasterSid]` on the table `BookingHeader` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[HBLNo,CompanyMasterSid]` on the table `HouseJob` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[MasterJobNumber,CompanyMasterSid]` on the table `MasterJob` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[VoucherNumber,CompanyMasterSid]` on the table `VoucherHeader` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "ApprovalStatus" ADD VALUE 'Open';

-- AlterTable
ALTER TABLE "CountryMaster" ADD COLUMN     "TeleCode" VARCHAR(10);

-- AlterTable
ALTER TABLE "CustomerBranch" ALTER COLUMN "Email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PortMaster" ADD COLUMN     "CityMasterSid" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "BookingHeader_BookingNo_CompanyMasterSid_key" ON "BookingHeader"("BookingNo", "CompanyMasterSid");

-- CreateIndex
CREATE UNIQUE INDEX "HouseJob_HBLNo_CompanyMasterSid_key" ON "HouseJob"("HBLNo", "CompanyMasterSid");

-- CreateIndex
CREATE UNIQUE INDEX "MasterJob_MasterJobNumber_CompanyMasterSid_key" ON "MasterJob"("MasterJobNumber", "CompanyMasterSid");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherHeader_VoucherNumber_CompanyMasterSid_key" ON "VoucherHeader"("VoucherNumber", "CompanyMasterSid");

-- AddForeignKey
ALTER TABLE "PortMaster" ADD CONSTRAINT "PortMaster_CityMasterSid_fkey" FOREIGN KEY ("CityMasterSid") REFERENCES "CityMaster"("CityMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
