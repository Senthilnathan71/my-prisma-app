-- CreateTable
CREATE TABLE "MeetingFollowup" (
    "MeetingFollowupSid" SERIAL NOT NULL,
    "PreCustomerMeetingSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER,
    "OpportunitySector" VARCHAR(20),
    "FollowupDate" TIMESTAMP(3) NOT NULL,
    "FollowupNote" VARCHAR(200) NOT NULL,
    "MeetingNote" VARCHAR(200) NOT NULL,
    "Remarks" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',

    CONSTRAINT "MeetingFollowup_pkey" PRIMARY KEY ("MeetingFollowupSid")
);
