-- AlterTable
ALTER TABLE "BranchMaster" ADD COLUMN     "BookingNoLen" INTEGER,
ADD COLUMN     "BookingPrefix" VARCHAR(20),
ADD COLUMN     "LastBookingNo" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "UserRoleMaster" ADD COLUMN     "UserCompanyMasterSid" INTEGER;

-- CreateIndex
CREATE INDEX "ReportMaster_ReportMenuSid_idx" ON "ReportMaster"("ReportMenuSid");

-- CreateIndex
CREATE INDEX "ReportMaster_ReportName_idx" ON "ReportMaster"("ReportName");

-- CreateIndex
CREATE INDEX "ReportMaster_Status_idx" ON "ReportMaster"("Status");

-- CreateIndex
CREATE INDEX "ReportMaster_ReportType_idx" ON "ReportMaster"("ReportType");

-- CreateIndex
CREATE INDEX "ReportMasterDetail_ReportMasterSid_idx" ON "ReportMasterDetail"("ReportMasterSid");

-- CreateIndex
CREATE INDEX "ReportMasterDetail_Status_idx" ON "ReportMasterDetail"("Status");

-- AddForeignKey
ALTER TABLE "UserRoleMaster" ADD CONSTRAINT "UserRoleMaster_UserCompanyMasterSid_fkey" FOREIGN KEY ("UserCompanyMasterSid") REFERENCES "UserCompanyMaster"("UserCompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
