-- CreateTable
CREATE TABLE "ReportSchedule" (
    "ReportScheduleSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "ScheduleName" VARCHAR(200) NOT NULL,
    "ReportMasterSid" INTEGER NOT NULL,
    "SubledgerMasterSid" INTEGER,
    "COAMasterSid" INTEGER,
    "BranchFilter" JSONB,
    "Frequency" VARCHAR(10) NOT NULL,
    "DayOfWeek" INTEGER,
    "DayOfMonth" INTEGER,
    "ScheduleTime" VARCHAR(5) NOT NULL,
    "TimeZone" VARCHAR(50),
    "ToEmails" VARCHAR(1000) NOT NULL,
    "CcEmails" VARCHAR(1000),
    "ReportFormat" VARCHAR(10) NOT NULL,
    "ReportParams" JSONB,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "LastRunAt" TIMESTAMPTZ(6),
    "LastRunStatus" VARCHAR(20),
    "LastRunMessage" VARCHAR(500),

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("ReportScheduleSid")
);

-- CreateIndex
CREATE INDEX "ReportSchedule_CompanyMasterSid_idx" ON "ReportSchedule"("CompanyMasterSid");

-- CreateIndex
CREATE INDEX "ReportSchedule_IsActive_idx" ON "ReportSchedule"("IsActive");

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_ReportMasterSid_fkey" FOREIGN KEY ("ReportMasterSid") REFERENCES "ReportMaster"("ReportMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_SubledgerMasterSid_fkey" FOREIGN KEY ("SubledgerMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
