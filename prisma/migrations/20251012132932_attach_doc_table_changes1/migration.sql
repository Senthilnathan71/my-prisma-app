-- AlterTable
ALTER TABLE "AttachDocument" ADD COLUMN     "MenuMasterSid" INTEGER,
ADD COLUMN     "menuName" INTEGER;

-- AddForeignKey
ALTER TABLE "AttachDocument" ADD CONSTRAINT "AttachDocument_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
