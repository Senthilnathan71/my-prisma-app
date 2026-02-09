-- DropForeignKey
ALTER TABLE "VoucherHeader" DROP CONSTRAINT "VoucherHeader_PartyMasterSid_fkey";

-- AlterTable
ALTER TABLE "StdRateHeader" ALTER COLUMN "CreatedOn" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "StdTariffDetail" ALTER COLUMN "CreatedOn" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "VoucherDetail" ADD COLUMN     "BookingRatesSid" INTEGER;

-- AlterTable
ALTER TABLE "VoucherHeader" ALTER COLUMN "PartyMasterSid" DROP NOT NULL,
ALTER COLUMN "PartyName" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "VoucherHeader" ADD CONSTRAINT "VoucherHeader_PartyMasterSid_fkey" FOREIGN KEY ("PartyMasterSid") REFERENCES "SubledgerMaster"("SubledgerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherDetail" ADD CONSTRAINT "VoucherDetail_BookingRatesSid_fkey" FOREIGN KEY ("BookingRatesSid") REFERENCES "BookingRates"("BookingRatesSid") ON DELETE SET NULL ON UPDATE CASCADE;
