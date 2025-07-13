-- DropForeignKey
ALTER TABLE "CityMaster" DROP CONSTRAINT "CityMaster_CountryMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "CityMaster" DROP CONSTRAINT "CityMaster_StateMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "StateMaster" DROP CONSTRAINT "StateMaster_CountryMasterSid_fkey";

-- AlterTable
ALTER TABLE "CityMaster" ALTER COLUMN "CountryMasterSid" DROP NOT NULL,
ALTER COLUMN "StateMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StateMaster" ALTER COLUMN "CountryMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "StateMaster" ADD CONSTRAINT "StateMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMaster" ADD CONSTRAINT "CityMaster_CountryMasterSid_fkey" FOREIGN KEY ("CountryMasterSid") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityMaster" ADD CONSTRAINT "CityMaster_StateMasterSid_fkey" FOREIGN KEY ("StateMasterSid") REFERENCES "StateMaster"("StateMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
