-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserTypeCode" ADD VALUE 'salesman';
ALTER TYPE "UserTypeCode" ADD VALUE 'salesManager';
ALTER TYPE "UserTypeCode" ADD VALUE 'csManager';
ALTER TYPE "UserTypeCode" ADD VALUE 'opsPerson';
ALTER TYPE "UserTypeCode" ADD VALUE 'opsManager';
ALTER TYPE "UserTypeCode" ADD VALUE 'docManager';
ALTER TYPE "UserTypeCode" ADD VALUE 'accounts';
ALTER TYPE "UserTypeCode" ADD VALUE 'accountsManager';
ALTER TYPE "UserTypeCode" ADD VALUE 'management';

-- AlterTable
ALTER TABLE "HSSACMaster" ADD COLUMN     "HSNorSAC" VARCHAR(3);
