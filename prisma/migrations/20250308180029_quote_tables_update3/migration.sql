/*
  Warnings:

  - You are about to drop the column `LoginSid` on the `QuoteCharge` table. All the data in the column will be lost.
  - Added the required column `UnitMasterSid` to the `QuoteCharge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fortyft` to the `QuoteCharge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `twentyft` to the `QuoteCharge` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "QuoteCharge" DROP CONSTRAINT "QuoteCharge_QuoteCarrierSid_fkey";

-- AlterTable
ALTER TABLE "QuoteCharge" DROP COLUMN "LoginSid",
ADD COLUMN     "UnitMasterSid" INTEGER NOT NULL,
ADD COLUMN     "fortyft" INTEGER NOT NULL,
ADD COLUMN     "twentyft" INTEGER NOT NULL,
ALTER COLUMN "QuoteCarrierSid" DROP NOT NULL,
ALTER COLUMN "CostRevenue" DROP NOT NULL,
ALTER COLUMN "ExchangeRate" DROP NOT NULL,
ALTER COLUMN "Rate" DROP NOT NULL,
ALTER COLUMN "Qty" DROP NOT NULL,
ALTER COLUMN "Amount" DROP NOT NULL,
ALTER COLUMN "Remarks" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_UnitMasterSid_fkey" FOREIGN KEY ("UnitMasterSid") REFERENCES "UnitMaster"("UnitMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteCharge" ADD CONSTRAINT "QuoteCharge_QuoteCarrierSid_fkey" FOREIGN KEY ("QuoteCarrierSid") REFERENCES "QuoteCarrier"("QuoteCarrierSid") ON DELETE SET NULL ON UPDATE CASCADE;
