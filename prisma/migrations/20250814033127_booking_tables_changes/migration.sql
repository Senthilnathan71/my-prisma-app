-- AlterTable
ALTER TABLE "BookingCargo" ADD COLUMN     "FreightTerms" VARCHAR(100),
ADD COLUMN     "MovementType" VARCHAR(100),
ADD COLUMN     "NoofContainers" INTEGER,
ADD COLUMN     "StuffingAt" VARCHAR(100),
ALTER COLUMN "Qty" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BookingConnection" ADD COLUMN     "BookingHeaderSid" INTEGER;

-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "CarrierName" VARCHAR(200),
ADD COLUMN     "Coload" VARCHAR(200),
ADD COLUMN     "GeneralNote" VARCHAR(200),
ADD COLUMN     "HBLNo" VARCHAR(200),
ADD COLUMN     "InternalNote" VARCHAR(200),
ADD COLUMN     "MBLDate" TIMESTAMP(3),
ADD COLUMN     "MBLNo" VARCHAR(200),
ADD COLUMN     "Nominated" VARCHAR(200),
ADD COLUMN     "NominatedBy" VARCHAR(200),
ADD COLUMN     "Notify" VARCHAR(200),
ADD COLUMN     "NotifyAddress" VARCHAR(200);

-- AlterTable
ALTER TABLE "BookingOthers" ADD COLUMN     "BookingHeaderSid" INTEGER,
ADD COLUMN     "Forwarder" VARCHAR(200),
ADD COLUMN     "ForwarderAddress" VARCHAR(200),
ADD COLUMN     "HBLNo" VARCHAR(200),
ALTER COLUMN "OperationUser" DROP NOT NULL,
ALTER COLUMN "DocumentationUser" DROP NOT NULL,
ALTER COLUMN "CustomerServiceuser" DROP NOT NULL,
ALTER COLUMN "PickupMode" DROP NOT NULL,
ALTER COLUMN "DeliveryMode" DROP NOT NULL,
ALTER COLUMN "ExternalRemarks" DROP NOT NULL,
ALTER COLUMN "TransporterName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BookingProduct" ADD COLUMN     "BookingHeaderSid" INTEGER,
ALTER COLUMN "ProductDescription" DROP NOT NULL,
ALTER COLUMN "ExternaPkg" DROP NOT NULL,
ALTER COLUMN "InternalPkg" DROP NOT NULL,
ALTER COLUMN "InternalQty" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_QuotationHeaderSid_fkey" FOREIGN KEY ("QuotationHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingProduct" ADD CONSTRAINT "BookingProduct_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingConnection" ADD CONSTRAINT "BookingConnection_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingOthers" ADD CONSTRAINT "BookingOthers_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;
