-- AlterTable
ALTER TABLE "CityMaster" ALTER COLUMN "cityCode" SET DATA TYPE CHAR(3);

-- AlterTable
ALTER TABLE "StateMaster" ALTER COLUMN "stateGSTCode" DROP NOT NULL;
