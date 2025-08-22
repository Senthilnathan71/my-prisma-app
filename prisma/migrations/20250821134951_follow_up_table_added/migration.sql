-- CreateTable
CREATE TABLE "Followup" (
    "FollowupSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',
    "DocumentSid" INTEGER,
    "AttachDocmentNo" VARCHAR(20),
    "DocumentDate" DATE,
    "FileName" VARCHAR(30),
    "Documenttype" VARCHAR(20),
    "ReceivedDate" DATE,
    "FollowupRequire" CHAR(1) NOT NULL DEFAULT 'N',
    "FollowupDate" DATE NOT NULL,
    "FollowupAction" VARCHAR(500) NOT NULL,
    "Remarks" VARCHAR(500),
    "Public" CHAR(1) NOT NULL DEFAULT 'N',
    "sentEmail" CHAR(1) DEFAULT 'N',

    CONSTRAINT "Followup_pkey" PRIMARY KEY ("FollowupSid")
);

-- AddForeignKey
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
