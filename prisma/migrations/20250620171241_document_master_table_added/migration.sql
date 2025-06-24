-- CreateTable
CREATE TABLE "DocumentTypeMaster" (
    "DocumentTypeMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "VoucherTypeName" VARCHAR(100) NOT NULL,
    "VoucherTypeCode" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(500),

    CONSTRAINT "DocumentTypeMaster_pkey" PRIMARY KEY ("DocumentTypeMasterSid")
);

-- AddForeignKey
ALTER TABLE "DocumentTypeMaster" ADD CONSTRAINT "DocumentTypeMaster_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTypeMaster" ADD CONSTRAINT "DocumentTypeMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
