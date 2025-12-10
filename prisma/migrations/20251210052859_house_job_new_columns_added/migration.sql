-- AlterTable
ALTER TABLE "HouseJobCargo" ADD COLUMN     "LandedMarksandNumber" VARCHAR(500);

-- AlterTable
ALTER TABLE "HouseJobProduct" ADD COLUMN     "DamageQty" DECIMAL(5,0),
ADD COLUMN     "DamageRemarks" VARCHAR(100),
ADD COLUMN     "ReceivedQty" DECIMAL(5,0);
