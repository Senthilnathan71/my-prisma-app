-- DropForeignKey
ALTER TABLE "PaymentRequest" DROP CONSTRAINT "PaymentRequest_Party_fkey";

-- DropForeignKey
ALTER TABLE "PublicAccessToken" DROP CONSTRAINT "PublicAccessToken_MenuMasterSid_fkey";

-- AlterTable
ALTER TABLE "MasterJobOthers" ADD COLUMN     "JobLossReason" VARCHAR(300);

-- AlterTable
ALTER TABLE "PaymentRequest" ALTER COLUMN "Party" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PublicAccessToken" ADD COLUMN     "Purpose" VARCHAR(50),
ALTER COLUMN "MenuMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ShipmentMilestone" ADD COLUMN     "BookingHeaderSid" INTEGER;

-- AlterTable
ALTER TABLE "VoucherHeader" ADD COLUMN     "CustomsDuty" CHAR(1) NOT NULL DEFAULT 'N';

-- CreateIndex
CREATE INDEX "PublicAccessToken_Purpose_ResourceSid_idx" ON "PublicAccessToken"("Purpose", "ResourceSid");

-- AddForeignKey
ALTER TABLE "ShipmentMilestone" ADD CONSTRAINT "ShipmentMilestone_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_Party_fkey" FOREIGN KEY ("Party") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicAccessToken" ADD CONSTRAINT "PublicAccessToken_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
