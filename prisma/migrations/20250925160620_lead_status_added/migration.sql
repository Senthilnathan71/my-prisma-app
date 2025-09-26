/*
  Warnings:

  - You are about to drop the column `opportunityStage` on the `PreCustomerMeeting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PreCustomerMaster" ADD COLUMN     "leadStatus" "LeadStatus" DEFAULT 'Discovery';

-- AlterTable
ALTER TABLE "PreCustomerMeeting" DROP COLUMN "opportunityStage";
