-- CreateTable
CREATE TABLE "CustomerGroupMaster" (
    "CustomerGroupMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "CustomerGroupName" VARCHAR(50) NOT NULL,
    "CustomerGroupCode" CHAR(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "CustomerGroupMaster_pkey" PRIMARY KEY ("CustomerGroupMasterSid")
);

-- AddForeignKey
ALTER TABLE "CustomerGroupMaster" ADD CONSTRAINT "CustomerGroupMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
