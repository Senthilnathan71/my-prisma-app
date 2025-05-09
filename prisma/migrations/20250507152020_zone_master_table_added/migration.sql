-- CreateTable
CREATE TABLE "ZoneMaster" (
    "ZoneMasterSid" SERIAL NOT NULL,
    "ZoneCode" CHAR(2) NOT NULL,
    "ZoneName" VARCHAR(100) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "ZoneMaster_pkey" PRIMARY KEY ("ZoneMasterSid")
);
