/*
  Warnings:

  - You are about to drop the column `isCompleted` on the `MeetingFollowup` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Followup" DROP CONSTRAINT "Followup_ExternalUser_fkey";

-- AlterTable
ALTER TABLE "MeetingFollowup" DROP COLUMN "isCompleted",
ADD COLUMN     "IsCompleted" CHAR(1) DEFAULT 'N';

-- AddForeignKey
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_ExternalUser_fkey" FOREIGN KEY ("ExternalUser") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
