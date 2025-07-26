-- AlterTable
ALTER TABLE "UserBranchMaster" ADD COLUMN     "GiveAccess" CHAR(1) DEFAULT 'N',
ADD COLUMN     "IsDefault" CHAR(1) DEFAULT 'N';
