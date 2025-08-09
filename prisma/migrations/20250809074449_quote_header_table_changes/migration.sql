-- DropForeignKey
ALTER TABLE "CompanyMaster" DROP CONSTRAINT "CompanyMaster_StateMasterSid_fkey";

-- AlterTable
ALTER TABLE "CompanyMaster" ALTER COLUMN "StateMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "QuoteRoute" ADD COLUMN     "CBM" TEXT,
ADD COLUMN     "ChargeableWeight" TEXT,
ADD COLUMN     "ContainerQty" TEXT,
ADD COLUMN     "ContainerType" INTEGER;

-- AddForeignKey
ALTER TABLE "CompanyMaster" ADD CONSTRAINT "CompanyMaster_StateMasterSid_fkey" FOREIGN KEY ("StateMasterSid") REFERENCES "StateMaster"("StateMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRoute" ADD CONSTRAINT "QuoteRoute_ContainerType_fkey" FOREIGN KEY ("ContainerType") REFERENCES "ContainerTypeMaster"("ContainerTypeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
