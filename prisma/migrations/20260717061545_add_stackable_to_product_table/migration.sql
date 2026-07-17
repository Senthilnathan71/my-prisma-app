-- AlterTable
ALTER TABLE "BookingProduct" ADD COLUMN     "IsStackable" CHAR(1) DEFAULT 'N';

-- AlterTable
ALTER TABLE "EnquiryCargo" ADD COLUMN     "IsStackable" CHAR(1) DEFAULT 'N';

-- AlterTable
ALTER TABLE "HouseJobProduct" ADD COLUMN     "IsStackable" CHAR(1) DEFAULT 'N';

-- AlterTable
ALTER TABLE "QuoteProduct" ADD COLUMN     "IsStackable" CHAR(1) DEFAULT 'N';
