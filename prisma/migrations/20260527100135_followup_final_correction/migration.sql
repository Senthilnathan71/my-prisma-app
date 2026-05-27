-- DropForeignKey
ALTER TABLE "Followup" DROP CONSTRAINT "Followup_ExternalUser_fkey";

-- AlterTable
ALTER TABLE "Followup" ALTER COLUMN "ExternalUser" SET DATA TYPE VARCHAR(100);
