-- CreateTable
CREATE TABLE "EnquiryHeader" (
    "EnquiryHeaderSid" SERIAL NOT NULL,
    "EnquiryDate" TIMESTAMP(3) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER,
    "CustomerMasterSid" INTEGER,
    "CustomerAddressSid" INTEGER,
    "UserMasterSid" INTEGER NOT NULL,
    "CustomerName" VARCHAR(100) NOT NULL,
    "CustomerAddress" VARCHAR(300) NOT NULL,
    "AgentMasterSid" INTEGER,
    "AgentAddressSid" INTEGER,
    "EnquiryType" VARCHAR(10) NOT NULL,
    "EnquiryBy" VARCHAR(10) NOT NULL,
    "IncoTerms" VARCHAR(50) NOT NULL,
    "ShipmentExpectedDate" TIMESTAMP(3),
    "ClearanceBy" VARCHAR(10) NOT NULL,
    "TransportBy" VARCHAR(10) NOT NULL,
    "DestinationClearance" VARCHAR(20) NOT NULL,
    "DestinationTransport" VARCHAR(20) NOT NULL,
    "ShipmentType" VARCHAR(20) NOT NULL,
    "RoutingNo" VARCHAR(20) NOT NULL,
    "ShipperRef" VARCHAR(20) NOT NULL,
    "Remarks" VARCHAR(100) NOT NULL,
    "MoveType" VARCHAR(10),
    "Email" VARCHAR(200) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) NOT NULL,
    "LoginSid" INTEGER,

    CONSTRAINT "EnquiryHeader_pkey" PRIMARY KEY ("EnquiryHeaderSid")
);

-- CreateTable
CREATE TABLE "EnquiryRoute" (
    "EnquiryRouteSid" SERIAL NOT NULL,
    "PORSid" INTEGER NOT NULL,
    "POLSid" INTEGER NOT NULL,
    "PODSid" INTEGER NOT NULL,
    "FDPSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "EnquiryHeaderSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "LoginSid" INTEGER,

    CONSTRAINT "EnquiryRoute_pkey" PRIMARY KEY ("EnquiryRouteSid")
);

-- AddForeignKey
ALTER TABLE "MeetingFollowup" ADD CONSTRAINT "MeetingFollowup_PreCustomerMeetingSid_fkey" FOREIGN KEY ("PreCustomerMeetingSid") REFERENCES "PreCustomerMeeting"("PreCustomerMeetingSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingFollowup" ADD CONSTRAINT "MeetingFollowup_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingFollowup" ADD CONSTRAINT "MeetingFollowup_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingFollowup" ADD CONSTRAINT "MeetingFollowup_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_UserMasterSid_fkey" FOREIGN KEY ("UserMasterSid") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRoute" ADD CONSTRAINT "EnquiryRoute_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRoute" ADD CONSTRAINT "EnquiryRoute_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRoute" ADD CONSTRAINT "EnquiryRoute_EnquiryHeaderSid_fkey" FOREIGN KEY ("EnquiryHeaderSid") REFERENCES "EnquiryHeader"("EnquiryHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
