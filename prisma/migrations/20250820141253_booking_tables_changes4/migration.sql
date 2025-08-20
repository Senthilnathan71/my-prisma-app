/*
  Warnings:

  - You are about to drop the column `Uom` on the `BookingProduct` table. All the data in the column will be lost.
  - You are about to alter the column `IsHaz` on the `BookingProduct` table. The data in that column could be lost. The data in that column will be cast from `VarChar(500)` to `Char(1)`.

*/
-- AlterTable
ALTER TABLE "BookingProduct" DROP COLUMN "Uom",
ADD COLUMN     "UomMasterSid" INTEGER,
ALTER COLUMN "IsHaz" SET DATA TYPE CHAR(1);

-- AddForeignKey
ALTER TABLE "BookingProduct" ADD CONSTRAINT "BookingProduct_UomMasterSid_fkey" FOREIGN KEY ("UomMasterSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
