-- AlterTable
ALTER TABLE "MailConfigurationMaster" ADD COLUMN     "UpdateFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
