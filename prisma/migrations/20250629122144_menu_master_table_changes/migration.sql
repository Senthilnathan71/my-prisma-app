-- AlterTable
ALTER TABLE "MenuMaster" ADD COLUMN     "AttachmentRequire" CHAR(1) DEFAULT 'N',
ADD COLUMN     "FollowupRequire" CHAR(1) DEFAULT 'N',
ADD COLUMN     "TandCRequire" CHAR(1) DEFAULT 'N';
