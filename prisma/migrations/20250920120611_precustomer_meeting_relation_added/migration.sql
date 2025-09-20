-- DropForeignKey
ALTER TABLE "PreCustomerMeeting" DROP CONSTRAINT "PreCustomerMeeting_PreCustomerMasterSid_fkey";

-- AlterTable
ALTER TABLE "ContainerTypeMaster" ALTER COLUMN "MaxVolume" DROP NOT NULL,
ALTER COLUMN "MaxVolume" SET DATA TYPE DECIMAL(7,3),
ALTER COLUMN "TareWeight" DROP NOT NULL,
ALTER COLUMN "GrossWeight" DROP NOT NULL,
ALTER COLUMN "Height" DROP NOT NULL,
ALTER COLUMN "Length" DROP NOT NULL,
ALTER COLUMN "Width" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomerMilestone" ALTER COLUMN "EffectiveFrom" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PreCustomerMeeting" ADD COLUMN     "CustomerMasterSid" INTEGER,
ALTER COLUMN "PreCustomerMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PreCustomerMeeting" ADD CONSTRAINT "PreCustomerMeeting_PreCustomerMasterSid_fkey" FOREIGN KEY ("PreCustomerMasterSid") REFERENCES "PreCustomerMaster"("PreCustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerMeeting" ADD CONSTRAINT "PreCustomerMeeting_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
