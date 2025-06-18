-- CreateTable
CREATE TABLE "MilestoneMaster" (
    "MilestoneMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "MilestoneName" VARCHAR(30) NOT NULL,
    "MilestoneCode" VARCHAR(30) NOT NULL,
    "AutomailRequire" CHAR(1) DEFAULT 'N',
    "SortBy" DECIMAL(3,0) NOT NULL,
    "ShipmentType" VARCHAR(100) NOT NULL,
    "AutoCapture" CHAR(1) NOT NULL DEFAULT 'N',
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(500) NOT NULL,

    CONSTRAINT "MilestoneMaster_pkey" PRIMARY KEY ("MilestoneMasterSid")
);

-- AddForeignKey
ALTER TABLE "MilestoneMaster" ADD CONSTRAINT "MilestoneMaster_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneMaster" ADD CONSTRAINT "MilestoneMaster_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneMaster" ADD CONSTRAINT "MilestoneMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
