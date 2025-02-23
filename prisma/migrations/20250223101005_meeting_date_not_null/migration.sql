/*
  Warnings:

  - Made the column `meetingDate` on table `PreCustomerMeeting` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PreCustomerMeeting" ALTER COLUMN "meetingDate" SET NOT NULL;
