-- AlterTable
ALTER TABLE "AuthorityDetail" ADD COLUMN     "AuthorityMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "DocumentTypeMaster" ADD COLUMN     "ReportFooter" VARCHAR(100),
ADD COLUMN     "ReportTitle" VARCHAR(100),
ADD COLUMN     "Type" VARCHAR(100);

-- AlterTable
ALTER TABLE "TermsAndConditionsMaster" ALTER COLUMN "Carrier" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EmailLog" (
    "EmailLogSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "EmailType" VARCHAR(20) NOT NULL,
    "SendDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Customer" INTEGER,
    "EmailTo" VARCHAR(200),
    "EmailCC" VARCHAR(200),
    "Subject" VARCHAR(500) NOT NULL,
    "Mailbody" VARCHAR(2000) NOT NULL,
    "ChargeRequire" CHAR(1) NOT NULL DEFAULT 'N',
    "DocumentSid" INTEGER NOT NULL,
    "FollowupRequire" CHAR(1) NOT NULL DEFAULT 'N',

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("EmailLogSid")
);

-- AddForeignKey
ALTER TABLE "AuthorityDetail" ADD CONSTRAINT "AuthorityDetail_AuthorityMasterSid_fkey" FOREIGN KEY ("AuthorityMasterSid") REFERENCES "AuthorityMaster"("AuthorityMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
