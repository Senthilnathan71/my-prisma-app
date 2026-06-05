/*
  Warnings:

  - You are about to drop the column `OriginAgent` on the `BookingHeader` table. All the data in the column will be lost.
  - You are about to drop the column `OriginAgentAddress` on the `BookingHeader` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BookingHeader" DROP COLUMN "OriginAgent",
DROP COLUMN "OriginAgentAddress";

-- AlterTable
ALTER TABLE "BookingOthers" ADD COLUMN     "OriginAgent" VARCHAR(200),
ADD COLUMN     "OriginAgentAddress" VARCHAR(300);
