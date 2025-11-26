-- AlterTable
ALTER TABLE "Followup" ADD COLUMN     "ExternalUser" VARCHAR(200),
ADD COLUMN     "InternalUser" VARCHAR(200);

-- AlterTable
ALTER TABLE "HouseJobProduct" ADD COLUMN     "HSCode" VARCHAR(10);
