-- CreateTable
CREATE TABLE "AttachDocument" (
    "AttachDocumentSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "DocumentSid" INTEGER,
    "AttachDocmentNo" VARCHAR(20) NOT NULL,
    "DocumentDate" DATE NOT NULL,
    "FileName" VARCHAR(30) NOT NULL,
    "Documenttype" VARCHAR(20) NOT NULL,
    "ReceivedDate" DATE,
    "FollowupRequire" CHAR(1) DEFAULT 'N',
    "FollowupDate" DATE,
    "Public" CHAR(1) NOT NULL DEFAULT 'N',
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(500),

    CONSTRAINT "AttachDocument_pkey" PRIMARY KEY ("AttachDocumentSid")
);

-- AddForeignKey
ALTER TABLE "AttachDocument" ADD CONSTRAINT "AttachDocument_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachDocument" ADD CONSTRAINT "AttachDocument_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
