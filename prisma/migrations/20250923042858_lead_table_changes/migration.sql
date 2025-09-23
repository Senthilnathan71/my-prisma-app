-- AlterTable
ALTER TABLE "PreCustomerMaster" ADD COLUMN     "isQualify" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PreCustomerMeeting" ADD COLUMN     "meetingEndDate" TIMESTAMP(3);
