-- AddForeignKey
ALTER TABLE "ShippingInstruction" ADD CONSTRAINT "ShippingInstruction_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;
