/*
  Warnings:

  - You are about to drop the column `pkgType` on the `BookingCargo` table. All the data in the column will be lost.
  - The `ContainerType` column on the `BookingCargo` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `ExternaPkg` on the `BookingProduct` table. The data in that column could be lost. The data in that column will be cast from `VarChar(100)` to `VarChar(10)`.
  - The `ExternlQty` column on the `BookingProduct` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `Carrier` on the `HouseJob` table. All the data in the column will be lost.
  - You are about to alter the column `IncoTerms` on the `HouseJob` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - You are about to alter the column `ExternaPkg` on the `HouseJobProduct` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `VarChar(10)`.
  - You are about to alter the column `ExternlQty` on the `HouseJobProduct` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(4,0)`.
  - You are about to drop the column `CarrierMasterSid` on the `MasterJobVoyage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BookingCargo" DROP COLUMN "pkgType",
ADD COLUMN     "PackageType" INTEGER,
DROP COLUMN "ContainerType",
ADD COLUMN     "ContainerType" INTEGER;

-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "CarrierSid" INTEGER;

-- AlterTable
ALTER TABLE "BookingProduct" ALTER COLUMN "ExternaPkg" SET DATA TYPE VARCHAR(10),
DROP COLUMN "ExternlQty",
ADD COLUMN     "ExternlQty" DECIMAL(4,0);

-- AlterTable
ALTER TABLE "HouseJob" DROP COLUMN "Carrier",
ADD COLUMN     "CarrierSid" INTEGER,
ADD COLUMN     "CustomerBranchSid" INTEGER,
ALTER COLUMN "IncoTerms" SET DATA TYPE VARCHAR(10);

-- AlterTable
ALTER TABLE "HouseJobCargo" ADD COLUMN     "NoOfContainer" INTEGER;

-- AlterTable
ALTER TABLE "HouseJobProduct" ALTER COLUMN "ExternaPkg" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "ExternlQty" SET DATA TYPE DECIMAL(4,0);

-- AlterTable
ALTER TABLE "MasterJobVoyage" DROP COLUMN "CarrierMasterSid",
ADD COLUMN     "CarrierSid" INTEGER;

-- AddForeignKey
ALTER TABLE "BookingCargo" ADD CONSTRAINT "BookingCargo_ContainerType_fkey" FOREIGN KEY ("ContainerType") REFERENCES "ContainerTypeMaster"("ContainerTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobCargo" ADD CONSTRAINT "HouseJobCargo_ContainerType_fkey" FOREIGN KEY ("ContainerType") REFERENCES "ContainerTypeMaster"("ContainerTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
