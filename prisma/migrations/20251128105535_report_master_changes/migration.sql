-- AlterTable
ALTER TABLE "Followup" ADD COLUMN     "IsCompleted" CHAR(1) DEFAULT 'N',
ADD COLUMN     "Subject" VARCHAR(200);

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "IsContract" CHAR(1) DEFAULT 'N';

-- AlterTable
ALTER TABLE "ReportMasterDetail" ADD COLUMN     "DefaultValue" VARCHAR(100),
ADD COLUMN     "ValidationRules" JSONB;
