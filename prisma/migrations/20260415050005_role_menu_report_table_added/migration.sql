-- AlterTable
ALTER TABLE "TariffDetail" ADD COLUMN     "ContainerType" INTEGER;

-- CreateTable
CREATE TABLE "RoleMenuReport" (
    "RoleMenuReportSid" SERIAL NOT NULL,
    "RoleMenuDetailSid" INTEGER NOT NULL,
    "ReportMasterSid" INTEGER NOT NULL,
    "ReportPermission" CHAR(1) DEFAULT 'N',
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedOn" TIMESTAMPTZ(6),
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "RoleMenuReport_pkey" PRIMARY KEY ("RoleMenuReportSid")
);

-- CreateIndex
CREATE INDEX "RoleMenuReport_RoleMenuDetailSid_ReportMasterSid_Status_idx" ON "RoleMenuReport"("RoleMenuDetailSid", "ReportMasterSid", "Status");

-- CreateIndex
CREATE INDEX "RoleMenuReport_ReportMasterSid_idx" ON "RoleMenuReport"("ReportMasterSid");

-- AddForeignKey
ALTER TABLE "TariffDetail" ADD CONSTRAINT "TariffDetail_ContainerType_fkey" FOREIGN KEY ("ContainerType") REFERENCES "ContainerTypeMaster"("ContainerTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuReport" ADD CONSTRAINT "RoleMenuReport_RoleMenuDetailSid_fkey" FOREIGN KEY ("RoleMenuDetailSid") REFERENCES "RoleMenuDetail"("RoleMenuDetailSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuReport" ADD CONSTRAINT "RoleMenuReport_ReportMasterSid_fkey" FOREIGN KEY ("ReportMasterSid") REFERENCES "ReportMaster"("ReportMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
