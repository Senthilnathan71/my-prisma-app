/*
  Warnings:

  - You are about to drop the column `ContainerMasterCode` on the `ContainerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `ContainerMasterName` on the `ContainerMaster` table. All the data in the column will be lost.
  - Added the required column `ContainerCode` to the `ContainerMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ContainerName` to the `ContainerMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ContainerMaster" DROP COLUMN "ContainerMasterCode",
DROP COLUMN "ContainerMasterName",
ADD COLUMN     "ContainerCode" VARCHAR(3) NOT NULL,
ADD COLUMN     "ContainerName" VARCHAR(100) NOT NULL;
