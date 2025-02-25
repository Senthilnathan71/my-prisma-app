/*
  Warnings:

  - You are about to drop the column `followupDate` on the `PreCustomerMeeting` table. All the data in the column will be lost.
  - You are about to alter the column `meetingStatus` on the `PreCustomerMeeting` table. The data in that column could be lost. The data in that column will be cast from `VarChar(10)` to `Char(1)`.

*/
-- AlterTable
ALTER TABLE "PreCustomerMeeting" DROP COLUMN "followupDate",
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "followUpNote" VARCHAR(100),
ADD COLUMN     "meetingNote" VARCHAR(100),
ALTER COLUMN "meetingStatus" SET DATA TYPE CHAR(1);
