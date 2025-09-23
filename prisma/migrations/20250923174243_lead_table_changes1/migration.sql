/*
  Warnings:

  - You are about to drop the column `meetingEndDate` on the `PreCustomerMeeting` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('Qualify', 'Discovery', 'MeetingScheduled', 'MeetingCompleted', 'EnquiryGenerated', 'QuotationCreated', 'QuotationConfirmed', 'ContractSigned', 'DealWon', 'DealLost');

-- AlterTable
ALTER TABLE "PreCustomerMeeting" DROP COLUMN "meetingEndDate",
ADD COLUMN     "opportunityStage" "LeadStatus" DEFAULT 'Discovery';
