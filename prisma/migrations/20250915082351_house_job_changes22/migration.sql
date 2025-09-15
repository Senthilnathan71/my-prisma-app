-- AlterTable
ALTER TABLE "HouseJobCargo" ADD COLUMN     "CommodityDescription" VARCHAR(200),
ADD COLUMN     "MarksAndNumber" VARCHAR(200);

-- AlterTable
ALTER TABLE "HouseJobProduct" ADD COLUMN     "MarksAndNumber" VARCHAR(200);
