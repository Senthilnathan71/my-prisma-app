/*
  Warnings:

  - Added the required column `createdBy` to the `MeetingFollowup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedOn` to the `MeetingFollowup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MeetingFollowup" ADD COLUMN     "createdBy" VARCHAR(100) NOT NULL,
ADD COLUMN     "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" VARCHAR(100),
ADD COLUMN     "updatedOn" TIMESTAMPTZ(6) NOT NULL;
