-- AlterTable
ALTER TABLE "UOMMaster" ADD COLUMN     "ContainerTypeMasterSid" INTEGER,
ADD COLUMN     "ContainerTypeReq" CHAR(1) DEFAULT 'N';

-- AddForeignKey
ALTER TABLE "UOMMaster" ADD CONSTRAINT "UOMMaster_ContainerTypeMasterSid_fkey" FOREIGN KEY ("ContainerTypeMasterSid") REFERENCES "ContainerTypeMaster"("ContainerTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
