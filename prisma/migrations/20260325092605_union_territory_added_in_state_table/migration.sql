-- AlterTable
ALTER TABLE "MasterJobOthers" ADD COLUMN     "ExportToImport" CHAR(1) NOT NULL DEFAULT 'N';

-- AlterTable
ALTER TABLE "StateMaster" ADD COLUMN     "IsUnionTerritory" CHAR(1) NOT NULL DEFAULT 'N';
