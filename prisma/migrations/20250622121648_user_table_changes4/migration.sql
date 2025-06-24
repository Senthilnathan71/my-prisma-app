-- DropForeignKey
ALTER TABLE "UserMaster" DROP CONSTRAINT "UserMaster_userTypeId_fkey";

-- AlterTable
ALTER TABLE "UserMaster" ALTER COLUMN "userTypeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_userTypeId_fkey" FOREIGN KEY ("userTypeId") REFERENCES "UserType"("UserTypeSid") ON DELETE SET NULL ON UPDATE CASCADE;
