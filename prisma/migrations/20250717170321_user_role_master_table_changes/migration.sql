/*
  Warnings:

  - A unique constraint covering the columns `[MenuMasterSid]` on the table `UserRoleMaster` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserRoleMaster" ADD COLUMN     "GiveAccess" CHAR(1) DEFAULT 'N',
ADD COLUMN     "IsDefault" CHAR(1) DEFAULT 'N',
ADD COLUMN     "MenuMasterSid" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleMaster_MenuMasterSid_key" ON "UserRoleMaster"("MenuMasterSid");

-- AddForeignKey
ALTER TABLE "UserRoleMaster" ADD CONSTRAINT "UserRoleMaster_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
