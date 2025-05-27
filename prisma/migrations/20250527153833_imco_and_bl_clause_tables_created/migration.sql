-- CreateTable
CREATE TABLE "ImcoMaster" (
    "ImcoMasterSid" SERIAL NOT NULL,
    "ImcoClass" VARCHAR(10) NOT NULL,
    "ImcoName" VARCHAR(20) NOT NULL,
    "Description" VARCHAR(100) NOT NULL,
    "ImcoUn" DECIMAL(6,0),
    "ImcoPageNo" DECIMAL(4,0),
    "PackingGroup" VARCHAR(10),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(100),

    CONSTRAINT "ImcoMaster_pkey" PRIMARY KEY ("ImcoMasterSid")
);

-- CreateTable
CREATE TABLE "BLClauseMaster" (
    "BLClauseMasterSid" SERIAL NOT NULL,
    "ClauseDescription" VARCHAR(500) NOT NULL,
    "Keyword" VARCHAR(5) NOT NULL,
    "Sortorder" DECIMAL(2,0),
    "DefaultClause" DECIMAL(3,0),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "BLClauseMaster_pkey" PRIMARY KEY ("BLClauseMasterSid")
);
