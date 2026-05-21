/*
  Warnings:

  - A unique constraint covering the columns `[NumberSeriesConfigSid,DepartmentMasterSid,YearMasterSid,Month,POLSid,PODSid]` on the table `NumberSeriesCounter` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "NumberSeriesCounter_NumberSeriesConfigSid_DepartmentMasterS_key";

-- AlterTable
ALTER TABLE "NumberSeriesConfig" ADD COLUMN     "POLPODFlagRequired" CHAR(1) NOT NULL DEFAULT 'N';

-- AlterTable
ALTER TABLE "NumberSeriesCounter" ADD COLUMN     "PODSid" INTEGER,
ADD COLUMN     "POLSid" INTEGER;

-- AlterTable
ALTER TABLE "UserBranchMaster" ADD COLUMN     "CostRevenueAccess" VARCHAR(20) NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE UNIQUE INDEX "NumberSeriesCounter_NumberSeriesConfigSid_DepartmentMasterS_key" ON "NumberSeriesCounter"("NumberSeriesConfigSid", "DepartmentMasterSid", "YearMasterSid", "Month", "POLSid", "PODSid");

-- AddForeignKey
ALTER TABLE "NumberSeriesCounter" ADD CONSTRAINT "NumberSeriesCounter_POLSid_fkey" FOREIGN KEY ("POLSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesCounter" ADD CONSTRAINT "NumberSeriesCounter_PODSid_fkey" FOREIGN KEY ("PODSid") REFERENCES "PortMaster"("PortMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
