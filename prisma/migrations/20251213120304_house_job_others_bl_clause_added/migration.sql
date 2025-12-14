-- AlterTable
ALTER TABLE "BLClauseMaster" ALTER COLUMN "DepartmentMasterSid" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HouseJobOthers" ADD COLUMN     "BlClause" TEXT[];
