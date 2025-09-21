-- DropForeignKey
ALTER TABLE "ChargeTds" DROP CONSTRAINT "ChargeTds_TDSSet_fkey";

-- AlterTable
ALTER TABLE "ChargeTds" ALTER COLUMN "TDSSet" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CurrencyExchange" ALTER COLUMN "BankName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "HSSACMaster" ALTER COLUMN "Remarks" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ChargeTds" ADD CONSTRAINT "ChargeTds_TDSSet_fkey" FOREIGN KEY ("TDSSet") REFERENCES "TDSSetHeader"("TDSSetHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
