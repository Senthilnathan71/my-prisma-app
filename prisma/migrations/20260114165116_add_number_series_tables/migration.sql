-- CreateTable
CREATE TABLE "NumberSeriesConfig" (
    "NumberSeriesConfigSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "CompanyFlagRequired" CHAR(1) NOT NULL DEFAULT 'N',
    "CompanyPrefix" VARCHAR(10),
    "BranchFlagRequired" CHAR(1) NOT NULL DEFAULT 'N',
    "BranchPrefix" VARCHAR(10),
    "DepartmentCodeRequired" CHAR(1) NOT NULL DEFAULT 'N',
    "MonthFlagRequired" CHAR(1) NOT NULL DEFAULT 'N',
    "YearFlagRequired" CHAR(1) NOT NULL DEFAULT 'N',
    "Separator" VARCHAR(5) NOT NULL DEFAULT '/',
    "NumberLength" INTEGER NOT NULL DEFAULT 5,
    "ResetOption" VARCHAR(10) NOT NULL DEFAULT 'None',
    "DepartmentWiseCounter" CHAR(1) NOT NULL DEFAULT 'N',
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',

    CONSTRAINT "NumberSeriesConfig_pkey" PRIMARY KEY ("NumberSeriesConfigSid")
);

-- CreateTable
CREATE TABLE "NumberSeriesCounter" (
    "NumberSeriesCounterSid" SERIAL NOT NULL,
    "NumberSeriesConfigSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER,
    "YearMasterSid" INTEGER,
    "Month" INTEGER,
    "LastNumber" INTEGER NOT NULL DEFAULT 0,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedOn" TIMESTAMPTZ(6),

    CONSTRAINT "NumberSeriesCounter_pkey" PRIMARY KEY ("NumberSeriesCounterSid")
);

-- CreateIndex
CREATE INDEX "NumberSeriesConfig_CompanyMasterSid_idx" ON "NumberSeriesConfig"("CompanyMasterSid");

-- CreateIndex
CREATE INDEX "NumberSeriesConfig_BranchMasterSid_idx" ON "NumberSeriesConfig"("BranchMasterSid");

-- CreateIndex
CREATE INDEX "NumberSeriesConfig_MenuMasterSid_idx" ON "NumberSeriesConfig"("MenuMasterSid");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSeriesConfig_CompanyMasterSid_BranchMasterSid_MenuMas_key" ON "NumberSeriesConfig"("CompanyMasterSid", "BranchMasterSid", "MenuMasterSid");

-- CreateIndex
CREATE INDEX "NumberSeriesCounter_CompanyMasterSid_BranchMasterSid_MenuMa_idx" ON "NumberSeriesCounter"("CompanyMasterSid", "BranchMasterSid", "MenuMasterSid");

-- CreateIndex
CREATE INDEX "NumberSeriesCounter_NumberSeriesConfigSid_idx" ON "NumberSeriesCounter"("NumberSeriesConfigSid");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSeriesCounter_NumberSeriesConfigSid_DepartmentMasterS_key" ON "NumberSeriesCounter"("NumberSeriesConfigSid", "DepartmentMasterSid", "YearMasterSid", "Month");

-- AddForeignKey
ALTER TABLE "NumberSeriesConfig" ADD CONSTRAINT "NumberSeriesConfig_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesConfig" ADD CONSTRAINT "NumberSeriesConfig_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesConfig" ADD CONSTRAINT "NumberSeriesConfig_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesCounter" ADD CONSTRAINT "NumberSeriesCounter_NumberSeriesConfigSid_fkey" FOREIGN KEY ("NumberSeriesConfigSid") REFERENCES "NumberSeriesConfig"("NumberSeriesConfigSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesCounter" ADD CONSTRAINT "NumberSeriesCounter_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesCounter" ADD CONSTRAINT "NumberSeriesCounter_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesCounter" ADD CONSTRAINT "NumberSeriesCounter_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesCounter" ADD CONSTRAINT "NumberSeriesCounter_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSeriesCounter" ADD CONSTRAINT "NumberSeriesCounter_YearMasterSid_fkey" FOREIGN KEY ("YearMasterSid") REFERENCES "YearMaster"("YearMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
