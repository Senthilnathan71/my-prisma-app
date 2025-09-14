-- CreateTable
CREATE TABLE "ReportMaster" (
    "ReportMasterSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "ReportName" VARCHAR(100) NOT NULL,
    "ReportDisplayName" VARCHAR(100) NOT NULL,
    "ReportMenuSid" INTEGER NOT NULL,
    "ReportType" VARCHAR(10),
    "ReportFormat" CHAR(5) NOT NULL,
    "ReportExcludedCompany" JSONB,

    CONSTRAINT "ReportMaster_pkey" PRIMARY KEY ("ReportMasterSid")
);

-- CreateTable
CREATE TABLE "ReportMasterDetail" (
    "ReportMasterDetailSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "ParameterName" VARCHAR(20) NOT NULL,
    "ParameterFieldType" VARCHAR(10) NOT NULL,
    "DropDownValue" JSONB,
    "ParameterQuery" VARCHAR(500),
    "ReportMasterSid" INTEGER NOT NULL,

    CONSTRAINT "ReportMasterDetail_pkey" PRIMARY KEY ("ReportMasterDetailSid")
);

-- AddForeignKey
ALTER TABLE "ReportMaster" ADD CONSTRAINT "ReportMaster_ReportMenuSid_fkey" FOREIGN KEY ("ReportMenuSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportMasterDetail" ADD CONSTRAINT "ReportMasterDetail_ReportMasterSid_fkey" FOREIGN KEY ("ReportMasterSid") REFERENCES "ReportMaster"("ReportMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
