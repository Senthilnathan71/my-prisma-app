-- AlterTable
ALTER TABLE "MenuMaster" ADD COLUMN     "AllowAdd" CHAR(1) DEFAULT 'N',
ADD COLUMN     "AllowDelete" CHAR(1) DEFAULT 'N',
ADD COLUMN     "AllowModify" CHAR(1) DEFAULT 'N',
ADD COLUMN     "AllowView" CHAR(1) DEFAULT 'N';
