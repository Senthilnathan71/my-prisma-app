/*
  Warnings:

  - You are about to drop the column `zone` on the `StateMaster` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StateMaster" DROP COLUMN "zone",
ADD COLUMN     "ZoneMasterSid" INTEGER;

-- AddForeignKey
ALTER TABLE "StateMaster" ADD CONSTRAINT "StateMaster_ZoneMasterSid_fkey" FOREIGN KEY ("ZoneMasterSid") REFERENCES "ZoneMaster"("ZoneMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
