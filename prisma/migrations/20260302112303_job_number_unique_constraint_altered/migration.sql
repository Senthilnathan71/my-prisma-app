/*
  Warnings:

  - A unique constraint covering the columns `[CompanyMasterSid,BookingNo]` on the table `BookingHeader` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[CompanyMasterSid,HBLNo]` on the table `HouseJob` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[CompanyMasterSid,MasterJobNumber]` on the table `MasterJob` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[CompanyMasterSid,VoucherNumber]` on the table `VoucherHeader` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "BookingHeader_BookingNo_CompanyMasterSid_key";

-- DropIndex
DROP INDEX "HouseJob_HBLNo_CompanyMasterSid_key";

-- DropIndex
DROP INDEX "MasterJob_MasterJobNumber_CompanyMasterSid_key";

-- DropIndex
DROP INDEX "VoucherHeader_VoucherNumber_CompanyMasterSid_key";

-- CreateIndex
CREATE UNIQUE INDEX "BookingHeader_CompanyMasterSid_BookingNo_key" ON "BookingHeader"("CompanyMasterSid", "BookingNo");

-- CreateIndex
CREATE UNIQUE INDEX "HouseJob_CompanyMasterSid_HBLNo_key" ON "HouseJob"("CompanyMasterSid", "HBLNo");

-- CreateIndex
CREATE UNIQUE INDEX "MasterJob_CompanyMasterSid_MasterJobNumber_key" ON "MasterJob"("CompanyMasterSid", "MasterJobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherHeader_CompanyMasterSid_VoucherNumber_key" ON "VoucherHeader"("CompanyMasterSid", "VoucherNumber");
