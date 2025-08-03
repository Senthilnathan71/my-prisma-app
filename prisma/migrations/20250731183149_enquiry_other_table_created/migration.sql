-- AlterTable
ALTER TABLE "EnquiryCargo" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "length" INTEGER,
ADD COLUMN     "width" INTEGER;

-- CreateTable
CREATE TABLE "EnquiryOther" (
    "EnquiryOtherSid" SERIAL NOT NULL,
    "EnquiryHeaderSid" INTEGER NOT NULL,
    "ShipperName" VARCHAR(100) NOT NULL,
    "ShipperAddress" VARCHAR(100) NOT NULL,
    "ConsigneeName" VARCHAR(100) NOT NULL,
    "ConsigneeAddress" VARCHAR(100) NOT NULL,
    "FreightTerms" VARCHAR(10) NOT NULL,
    "ShipmentFreq" VARCHAR(10) NOT NULL,
    "AdditionalService" VARCHAR(10) NOT NULL,
    "Stuffing" VARCHAR(10) NOT NULL,
    "ModeofBL" VARCHAR(10) NOT NULL,
    "PickupAddress" VARCHAR(100) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" VARCHAR(100) NOT NULL,
    "LoginSid" INTEGER NOT NULL,
    "Status" CHAR(1) NOT NULL DEFAULT 'A',

    CONSTRAINT "EnquiryOther_pkey" PRIMARY KEY ("EnquiryOtherSid")
);

-- AddForeignKey
ALTER TABLE "EnquiryOther" ADD CONSTRAINT "EnquiryOther_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryOther" ADD CONSTRAINT "EnquiryOther_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryOther" ADD CONSTRAINT "EnquiryOther_EnquiryHeaderSid_fkey" FOREIGN KEY ("EnquiryHeaderSid") REFERENCES "EnquiryHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
