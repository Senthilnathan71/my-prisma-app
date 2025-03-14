-- CreateTable
CREATE TABLE "ContainerMaster" (
    "ContainerMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "ContainerMasterName" VARCHAR(100) NOT NULL,
    "ContainerMasterCode" VARCHAR(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "ContainerMaster_pkey" PRIMARY KEY ("ContainerMasterSid")
);

-- AddForeignKey
ALTER TABLE "ContainerMaster" ADD CONSTRAINT "ContainerMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
