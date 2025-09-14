-- AlterTable
ALTER TABLE "VoucherOthers" ADD COLUMN     "ContainerNumber" VARCHAR(100),
ADD COLUMN     "VoucherNote" VARCHAR(200),
ADD COLUMN     "VoucherReverseSid" INTEGER;
