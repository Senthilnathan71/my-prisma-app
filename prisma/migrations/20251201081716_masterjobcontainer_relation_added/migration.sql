-- AlterTable
ALTER TABLE "MasterJobContainer" ALTER COLUMN "ContainerType" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MasterJobContainer" ADD CONSTRAINT "MasterJobContainer_ContainerType_fkey" FOREIGN KEY ("ContainerType") REFERENCES "ContainerTypeMaster"("ContainerTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
