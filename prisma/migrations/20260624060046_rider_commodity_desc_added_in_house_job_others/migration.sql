-- AlterTable
ALTER TABLE "HouseJobOthers" ADD COLUMN     "RiderCommodityDescription" VARCHAR(2000);

-- AlterTable
ALTER TABLE "VoucherOthers" ADD COLUMN     "ResourcePerson" INTEGER;

-- AddForeignKey
ALTER TABLE "VoucherOthers" ADD CONSTRAINT "VoucherOthers_ResourcePerson_fkey" FOREIGN KEY ("ResourcePerson") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
