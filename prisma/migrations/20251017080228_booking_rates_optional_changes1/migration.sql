-- DropForeignKey
ALTER TABLE "BookingRates" DROP CONSTRAINT "BookingRates_CustomerBranchSid_fkey";

-- DropForeignKey
ALTER TABLE "BookingRates" DROP CONSTRAINT "BookingRates_CustomerMasterSid_fkey";

-- AlterTable
ALTER TABLE "BookingRates" ALTER COLUMN "CustomerMasterSid" DROP NOT NULL,
ALTER COLUMN "CustomerBranchSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRates" ADD CONSTRAINT "BookingRates_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
