/*
  Warnings:

  - You are about to drop the column `EventCity` on the `PreCustomerEvent` table. All the data in the column will be lost.
  - Added the required column `CityMasterSid` to the `PreCustomerEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PreCustomerEvent" DROP COLUMN "EventCity",
ADD COLUMN     "CityMasterSid" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "PreCustomerEvent" ADD CONSTRAINT "PreCustomerEvent_CityMasterSid_fkey" FOREIGN KEY ("CityMasterSid") REFERENCES "CityMaster"("CityMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
