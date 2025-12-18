/*
  Warnings:

  - You are about to alter the column `Height` on the `BookingProduct` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `Length` on the `BookingProduct` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `Width` on the `BookingProduct` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `Height` on the `HouseJobProduct` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `Length` on the `HouseJobProduct` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.
  - You are about to alter the column `Width` on the `HouseJobProduct` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(8,2)`.

*/
-- AlterTable
ALTER TABLE "BookingProduct" ALTER COLUMN "Height" SET DATA TYPE DECIMAL(8,2),
ALTER COLUMN "Length" SET DATA TYPE DECIMAL(8,2),
ALTER COLUMN "Width" SET DATA TYPE DECIMAL(8,2);

-- AlterTable
ALTER TABLE "HouseJobProduct" ALTER COLUMN "Height" SET DATA TYPE DECIMAL(8,2),
ALTER COLUMN "Length" SET DATA TYPE DECIMAL(8,2),
ALTER COLUMN "Width" SET DATA TYPE DECIMAL(8,2);
