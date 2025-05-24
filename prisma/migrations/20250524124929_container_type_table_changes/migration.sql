/*
  Warnings:

  - You are about to drop the column `ContainerCateory` on the `ContainerTypeMaster` table. All the data in the column will be lost.
  - You are about to drop the column `NoofTeu` on the `ContainerTypeMaster` table. All the data in the column will be lost.
  - Added the required column `Height` to the `ContainerTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Length` to the `ContainerTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `NoOfTeu` to the `ContainerTypeMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Width` to the `ContainerTypeMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ContainerTypeMaster" DROP COLUMN "ContainerCateory",
DROP COLUMN "NoofTeu",
ADD COLUMN     "ContainerCategory" VARCHAR(10),
ADD COLUMN     "Height" INTEGER NOT NULL,
ADD COLUMN     "Length" INTEGER NOT NULL,
ADD COLUMN     "NoOfTeu" DECIMAL(1,0) NOT NULL,
ADD COLUMN     "Width" INTEGER NOT NULL,
ALTER COLUMN "ContainerSize" SET DATA TYPE CHAR(10),
ALTER COLUMN "ContainerIsoCode" SET DATA TYPE VARCHAR(10);
