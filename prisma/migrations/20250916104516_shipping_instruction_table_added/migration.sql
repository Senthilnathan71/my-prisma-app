-- CreateTable
CREATE TABLE "ShippingInstruction" (
    "ShippingInstructionSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',
    "HouseJobSid" INTEGER NOT NULL,
    "Remarks" VARCHAR(200),

    CONSTRAINT "ShippingInstruction_pkey" PRIMARY KEY ("ShippingInstructionSid")
);

-- CreateTable
CREATE TABLE "ActivityResourceAllocation" (
    "ActivityResourceAllocationSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',
    "HouseJobSid" INTEGER,
    "EnquiryHeaderSid" INTEGER,
    "QuoteHeaderSid" INTEGER,
    "BookingHeaderSid" INTEGER,
    "MasterJobSid" INTEGER,
    "EnquiryUser" INTEGER,
    "QuoteUser" INTEGER,
    "BookingUser" INTEGER,
    "MasterJobUser" INTEGER,
    "HouseJobUser" INTEGER,
    "SIUser" INTEGER,

    CONSTRAINT "ActivityResourceAllocation_pkey" PRIMARY KEY ("ActivityResourceAllocationSid")
);

-- AddForeignKey
ALTER TABLE "ShippingInstruction" ADD CONSTRAINT "ShippingInstruction_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingInstruction" ADD CONSTRAINT "ShippingInstruction_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_EnquiryHeaderSid_fkey" FOREIGN KEY ("EnquiryHeaderSid") REFERENCES "EnquiryHeader"("EnquiryHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_QuoteHeaderSid_fkey" FOREIGN KEY ("QuoteHeaderSid") REFERENCES "QuoteHeader"("QuoteHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_EnquiryUser_fkey" FOREIGN KEY ("EnquiryUser") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_QuoteUser_fkey" FOREIGN KEY ("QuoteUser") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_BookingUser_fkey" FOREIGN KEY ("BookingUser") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_MasterJobUser_fkey" FOREIGN KEY ("MasterJobUser") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_HouseJobUser_fkey" FOREIGN KEY ("HouseJobUser") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResourceAllocation" ADD CONSTRAINT "ActivityResourceAllocation_SIUser_fkey" FOREIGN KEY ("SIUser") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
