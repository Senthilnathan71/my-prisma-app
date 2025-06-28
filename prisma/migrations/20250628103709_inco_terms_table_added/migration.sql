-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IncoMaster" (
    "IncoMasterSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "deletedAt" TIMESTAMP(3),
    "IncoCode" CHAR(3) NOT NULL,
    "IncoName" VARCHAR(100) NOT NULL,
    "IncoType" CHAR(3) NOT NULL,
    "OceanFreight" VARCHAR(7) NOT NULL,

    CONSTRAINT "IncoMaster_pkey" PRIMARY KEY ("IncoMasterSid")
);
