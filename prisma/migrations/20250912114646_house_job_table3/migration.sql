-- AlterTable
ALTER TABLE "HouseJob" ADD COLUMN     "BookingHeaderSid" INTEGER;

-- AddForeignKey
ALTER TABLE "HouseJob" ADD CONSTRAINT "HouseJob_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
