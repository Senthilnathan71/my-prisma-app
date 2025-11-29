-- DropForeignKey
ALTER TABLE "HouseJobCustoms" DROP CONSTRAINT "HouseJobCustoms_HouseJobSid_fkey";

-- AlterTable
ALTER TABLE "HouseJobCustoms" ADD COLUMN     "MasterJobSid" INTEGER,
ALTER COLUMN "HouseJobSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "HouseJobCustoms" ADD CONSTRAINT "HouseJobCustoms_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobCustoms" ADD CONSTRAINT "HouseJobCustoms_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE SET NULL ON UPDATE CASCADE;
