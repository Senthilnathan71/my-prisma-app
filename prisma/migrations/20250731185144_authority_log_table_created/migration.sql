-- CreateTable
CREATE TABLE "AuthorityLog" (
    "AuthorityLogSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "AuthorityDetailSid" INTEGER NOT NULL,
    "AuthorisedDate" TIMESTAMP(3) NOT NULL,
    "ApprovalStatus" VARCHAR(10) NOT NULL DEFAULT 'Approved',
    "DocumentSid" INTEGER NOT NULL,
    "Remarks" VARCHAR(500),

    CONSTRAINT "AuthorityLog_pkey" PRIMARY KEY ("AuthorityLogSid")
);

-- AddForeignKey
ALTER TABLE "AuthorityLog" ADD CONSTRAINT "AuthorityLog_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityLog" ADD CONSTRAINT "AuthorityLog_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityLog" ADD CONSTRAINT "AuthorityLog_AuthorityDetailSid_fkey" FOREIGN KEY ("AuthorityDetailSid") REFERENCES "AuthorityDetail"("AuthorityDetailSid") ON DELETE RESTRICT ON UPDATE CASCADE;
