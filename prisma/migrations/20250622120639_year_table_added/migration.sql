-- CreateTable
CREATE TABLE "YearMaster" (
    "YearMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "YearName" VARCHAR(10) NOT NULL,
    "YearCode" INTEGER NOT NULL,
    "StartDate" TIMESTAMP(3) NOT NULL,
    "EndDate" TIMESTAMP(3) NOT NULL,
    "CurrentYear" CHAR(1) NOT NULL,
    "YearEndCompleted" CHAR(1) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(500),

    CONSTRAINT "YearMaster_pkey" PRIMARY KEY ("YearMasterSid")
);

-- AddForeignKey
ALTER TABLE "YearMaster" ADD CONSTRAINT "YearMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
