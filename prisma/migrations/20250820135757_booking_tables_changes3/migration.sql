-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "OriginAgent" VARCHAR(200);

-- AlterTable
ALTER TABLE "BookingOthers" ADD COLUMN     "AgentAddress" VARCHAR(200),
ADD COLUMN     "SwitchBLAgent" VARCHAR(200),
ADD COLUMN     "SwitchBLConsignee" VARCHAR(200),
ADD COLUMN     "SwitchBLShipper" VARCHAR(200),
ADD COLUMN     "SwitchLocation" VARCHAR(200);

-- AlterTable
ALTER TABLE "BookingProduct" ADD COLUMN     "Height" INTEGER,
ADD COLUMN     "ImcoClass" VARCHAR(500),
ADD COLUMN     "IsHaz" VARCHAR(500),
ADD COLUMN     "Length" INTEGER,
ADD COLUMN     "PkgGroup" VARCHAR(500),
ADD COLUMN     "UnNo" VARCHAR(500),
ADD COLUMN     "Uom" INTEGER,
ADD COLUMN     "Width" INTEGER;
