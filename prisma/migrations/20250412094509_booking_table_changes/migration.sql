-- DropForeignKey
ALTER TABLE "BookingCargo" DROP CONSTRAINT "BookingCargo_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "BookingHeader" DROP CONSTRAINT "BookingHeader_BranchMasterSid_fkey";

-- AlterTable
ALTER TABLE "BookingCargo" ALTER COLUMN "BranchMasterSid" DROP NOT NULL,
ALTER COLUMN "FreightAmount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BookingHeader" ALTER COLUMN "BranchMasterSid" DROP NOT NULL,
ALTER COLUMN "CustomerName" DROP NOT NULL,
ALTER COLUMN "CustomerAddress" DROP NOT NULL,
ALTER COLUMN "SalesmanSid" DROP NOT NULL,
ALTER COLUMN "CargoExpectedon" DROP NOT NULL,
ALTER COLUMN "POO" DROP NOT NULL,
ALTER COLUMN "FPD" DROP NOT NULL,
ALTER COLUMN "ShipmentType" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCargo" ADD CONSTRAINT "BookingCargo_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
