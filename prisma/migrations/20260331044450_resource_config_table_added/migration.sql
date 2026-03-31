-- CreateTable
CREATE TABLE "ResourceConfiguration" (
    "ResourceConfigurationSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "Stage" VARCHAR(50) NOT NULL,
    "AssignedRole" VARCHAR(10),
    "UserMasterSid" INTEGER,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100),
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "ResourceConfiguration_pkey" PRIMARY KEY ("ResourceConfigurationSid")
);

-- AddForeignKey
ALTER TABLE "ResourceConfiguration" ADD CONSTRAINT "ResourceConfiguration_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceConfiguration" ADD CONSTRAINT "ResourceConfiguration_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceConfiguration" ADD CONSTRAINT "ResourceConfiguration_UserMasterSid_fkey" FOREIGN KEY ("UserMasterSid") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
