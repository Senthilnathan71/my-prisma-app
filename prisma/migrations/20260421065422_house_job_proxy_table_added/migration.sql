-- DropForeignKey
ALTER TABLE "TandCTransaction" DROP CONSTRAINT "TandCTransaction_TandCDetailSid_fkey";

-- DropForeignKey
ALTER TABLE "TandCTransaction" DROP CONSTRAINT "TandCTransaction_TandCMasterSid_fkey";

-- AlterTable
ALTER TABLE "TandCTransaction" ADD COLUMN     "MenuMasterSid" INTEGER,
ALTER COLUMN "TandCMasterSid" DROP NOT NULL,
ALTER COLUMN "TandCDetailSid" DROP NOT NULL;

-- CreateTable
CREATE TABLE "HouseJobProxy" (
    "HouseJobProxySid" SERIAL NOT NULL,
    "HouseJobSid" INTEGER NOT NULL,
    "CustomerName" VARCHAR(100),
    "CustomerAddress" VARCHAR(300),
    "AgentName" VARCHAR(100),
    "AgentAddress" VARCHAR(300),
    "ShipperName" VARCHAR(100),
    "ShipperAddress" VARCHAR(300),
    "ConsigneeName" VARCHAR(100),
    "ConsigneeAddress" VARCHAR(300),
    "VesselName" VARCHAR(100),
    "VoyageNo" VARCHAR(10),
    "POO" VARCHAR(100),
    "FPD" VARCHAR(100),
    "CarrierName" VARCHAR(200),
    "CreatedBy" VARCHAR(100) NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "UpdatedOn" TIMESTAMPTZ(6),
    "Status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "HouseJobProxy_pkey" PRIMARY KEY ("HouseJobProxySid")
);

-- CreateIndex
CREATE INDEX "idx_tandc_menu_doc" ON "TandCTransaction"("DocumentSid", "MenuMasterSid");

-- AddForeignKey
ALTER TABLE "TandCTransaction" ADD CONSTRAINT "TandCTransaction_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TandCTransaction" ADD CONSTRAINT "TandCTransaction_TandCDetailSid_fkey" FOREIGN KEY ("TandCDetailSid") REFERENCES "TermsAndConditionsDetail"("TermsAndConditionsDetailSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TandCTransaction" ADD CONSTRAINT "TandCTransaction_TandCMasterSid_fkey" FOREIGN KEY ("TandCMasterSid") REFERENCES "TermsAndConditionsMaster"("TermsAndConditionsMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseJobProxy" ADD CONSTRAINT "HouseJobProxy_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;
