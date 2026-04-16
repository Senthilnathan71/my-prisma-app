-- AlterTable
ALTER TABLE "BookingProduct" ADD COLUMN     "BookingCargoSid" INTEGER;

-- AlterTable
ALTER TABLE "HouseJobProduct" ADD COLUMN     "HouseJobCargoSid" INTEGER;

-- AddForeignKey
ALTER TABLE "BookingProduct" ADD CONSTRAINT "BookingProduct_BookingCargoSid_fkey" FOREIGN KEY ("BookingCargoSid") REFERENCES "BookingCargo"("BookingCargoSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobProduct" ADD CONSTRAINT "HouseJobProduct_HouseJobCargoSid_fkey" FOREIGN KEY ("HouseJobCargoSid") REFERENCES "HouseJobCargo"("HouseJobCargoSid") ON DELETE SET NULL ON UPDATE CASCADE;
