-- CreateTable
CREATE TABLE "VoucherPeriod" (
    "VoucherPeriodSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "YearMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "PeriodCode" INTEGER NOT NULL,
    "PeriodName" VARCHAR(10) NOT NULL,
    "StartDate" DATE NOT NULL,
    "EndDate" DATE NOT NULL,
    "Remarks" VARCHAR(200),
    "APClosed" CHAR(1),
    "APGraceDays" DECIMAL(3,0),
    "ARClosed" CHAR(1),
    "ARGraceDays" DECIMAL(3,0),
    "GLClosed" CHAR(1),
    "GLGraceDays" DECIMAL(3,0),

    CONSTRAINT "VoucherPeriod_pkey" PRIMARY KEY ("VoucherPeriodSid")
);

-- AddForeignKey
ALTER TABLE "VoucherPeriod" ADD CONSTRAINT "VoucherPeriod_YearMasterSid_fkey" FOREIGN KEY ("YearMasterSid") REFERENCES "YearMaster"("YearMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPeriod" ADD CONSTRAINT "VoucherPeriod_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPeriod" ADD CONSTRAINT "VoucherPeriod_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
