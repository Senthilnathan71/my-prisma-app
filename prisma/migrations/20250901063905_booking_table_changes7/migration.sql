-- AlterTable
ALTER TABLE "BookingCargo" ADD COLUMN     "ModeOfTransport" VARCHAR(100);

-- AlterTable
ALTER TABLE "BookingProduct" ADD COLUMN     "ActualGrWeight" DECIMAL(10,3),
ADD COLUMN     "ActualQty" VARCHAR(100),
ADD COLUMN     "ActualVolume" DECIMAL(10,3),
ADD COLUMN     "CFS" VARCHAR(100),
ADD COLUMN     "CargoRecDate" TIMESTAMP(3),
ADD COLUMN     "RecdPack" VARCHAR(100);
