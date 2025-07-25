-- DropForeignKey
ALTER TABLE "ChargeMaster" DROP CONSTRAINT "ChargeMaster_TDSMasterSid_fkey";

-- AlterTable
ALTER TABLE "ChargeMaster" ALTER COLUMN "HSNSAC" DROP NOT NULL,
ALTER COLUMN "TDSMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChargeTaxMaster" ALTER COLUMN "TaxGroup" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL,
ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChargeTds" ADD COLUMN     "EffectiveFrom" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ChargeMaster" ADD CONSTRAINT "ChargeMaster_TDSMasterSid_fkey" FOREIGN KEY ("TDSMasterSid") REFERENCES "TDSSetHeader"("TDSSetHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
