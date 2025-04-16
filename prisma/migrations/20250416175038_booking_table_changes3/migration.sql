/*
  Warnings:

  - Added the required column `Remarks` to the `UnitMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `containerType` to the `UnitMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `UnitMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BookingHeader" ALTER COLUMN "FreightTerms" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UnitMaster" ADD COLUMN     "Remarks" VARCHAR(100) NOT NULL,
ADD COLUMN     "containerType" VARCHAR(20) NOT NULL,
ADD COLUMN     "createdBy" VARCHAR(100) NOT NULL,
ADD COLUMN     "status" CHAR(1) NOT NULL DEFAULT 'A',
ADD COLUMN     "updatedBy" VARCHAR(100);

-- AlterTable
ALTER TABLE "VoyageMasterDetail" ALTER COLUMN "ATA" DROP NOT NULL,
ALTER COLUMN "ATD" DROP NOT NULL;
