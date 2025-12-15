/*
  Warnings:

  - You are about to alter the column `ContainerSize` on the `ContainerTypeMaster` table. The data in that column could be lost. The data in that column will be cast from `VarChar(100)` to `VarChar(10)`.
  - You are about to alter the column `Height` on the `ContainerTypeMaster` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(7,3)`.
  - You are about to alter the column `Length` on the `ContainerTypeMaster` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(7,3)`.
  - You are about to alter the column `Width` on the `ContainerTypeMaster` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(7,3)`.

*/
-- AlterTable
ALTER TABLE "ContainerTypeMaster" ALTER COLUMN "ContainerSize" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "MaxVolume" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "TareWeight" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "GrossWeight" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "Height" SET DATA TYPE DECIMAL(7,3),
ALTER COLUMN "Length" SET DATA TYPE DECIMAL(7,3),
ALTER COLUMN "Width" SET DATA TYPE DECIMAL(7,3);
