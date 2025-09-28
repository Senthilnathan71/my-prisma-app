-- DropForeignKey
ALTER TABLE "TariffHeader" DROP CONSTRAINT "TariffHeader_Carrier_fkey";

-- AlterTable
ALTER TABLE "TariffHeader" ALTER COLUMN "Carrier" DROP NOT NULL,
ALTER COLUMN "StuffingAt" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TariffHeader" ADD CONSTRAINT "TariffHeader_Carrier_fkey" FOREIGN KEY ("Carrier") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
