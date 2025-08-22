-- AlterTable
ALTER TABLE "BookingOthers" ADD COLUMN     "Coloader" VARCHAR(100),
ADD COLUMN     "Notify2" VARCHAR(100),
ADD COLUMN     "NotifyAddress2" VARCHAR(200);

-- AlterTable
ALTER TABLE "BookingRates" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ShipmentMilestone" ADD COLUMN     "deletedAt" TIMESTAMP(3);
