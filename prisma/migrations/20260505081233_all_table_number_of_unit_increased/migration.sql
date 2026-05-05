-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "PortCutoffDate" DATE;

-- AlterTable
ALTER TABLE "CompanyConfiguration" ADD COLUMN     "ConfigType" VARCHAR(20),
ADD COLUMN     "DisplayName" VARCHAR(200);

-- AlterTable
ALTER TABLE "HouseJobBOE" ADD COLUMN     "GrossWeight" DECIMAL(10,3),
ADD COLUMN     "Volume" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "PaymentRequestDetail" ALTER COLUMN "CostNumberOfUnit" SET DATA TYPE DECIMAL(9,3);

-- AlterTable
ALTER TABLE "QuoteCharge" ALTER COLUMN "Qty" SET DATA TYPE DECIMAL(9,3),
ALTER COLUMN "CostNumberOfUnit" SET DATA TYPE DECIMAL(9,3),
ALTER COLUMN "RevenueNumberOfUnit" SET DATA TYPE DECIMAL(9,3);

-- AlterTable
ALTER TABLE "VoucherTransaction" ALTER COLUMN "NumberOfUnit" SET DATA TYPE DECIMAL(9,3);
