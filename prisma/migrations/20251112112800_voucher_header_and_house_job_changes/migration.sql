-- AlterTable
ALTER TABLE "HouseJob" ADD COLUMN     "HBLDate" TIMESTAMP(3),
ADD COLUMN     "HBLType" VARCHAR(12);

-- AlterTable
ALTER TABLE "VoucherHeader" ADD COLUMN     "CashOrBank" CHAR(1) DEFAULT 'C',
ADD COLUMN     "MultiBranch" CHAR(1) DEFAULT 'N';
