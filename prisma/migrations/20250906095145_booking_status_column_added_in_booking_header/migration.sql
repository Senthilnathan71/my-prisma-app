-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "BookingStatus" VARCHAR(100);

-- AlterTable
ALTER TABLE "MasterJob" ALTER COLUMN "MasterJobNumber" SET DATA TYPE VARCHAR(100);
