-- AlterTable
ALTER TABLE "HawbStock" ADD COLUMN     "AvailableStatus" VARCHAR(15) DEFAULT 'Available',
ADD COLUMN     "Customer" INTEGER;

-- AlterTable
ALTER TABLE "MawbStock" ADD COLUMN     "Customer" INTEGER;
