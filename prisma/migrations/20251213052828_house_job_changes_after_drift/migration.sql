-- AlterTable
ALTER TABLE "ContainerTypeMaster" ALTER COLUMN "ContainerSize" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "HouseJob" ADD COLUMN     "HBLCount" DECIMAL(2,0) NOT NULL DEFAULT 0,
ADD COLUMN     "HouseStatus" VARCHAR(30) NOT NULL DEFAULT 'Job Generated';

-- AlterTable
ALTER TABLE "MasterJob" ADD COLUMN     "JobStatus" VARCHAR(30) NOT NULL DEFAULT 'Job Generated';

-- AlterTable
ALTER TABLE "QuoteHeader" ALTER COLUMN "ContactPerson" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "VoucherMatchingHeader" ADD COLUMN     "SubledgerName" VARCHAR(100);
