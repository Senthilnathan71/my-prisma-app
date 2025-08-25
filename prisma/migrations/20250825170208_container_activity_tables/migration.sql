-- AlterTable
ALTER TABLE "Followup" ADD COLUMN     "deletedAt" INTEGER;

-- CreateTable
CREATE TABLE "ContainerActivity" (
    "ContainerActivitySid" SERIAL NOT NULL,
    "JobMasterSid" INTEGER NOT NULL,
    "ContainerNumber" VARCHAR(11),
    "ContainerType" INTEGER NOT NULL,
    "ActivityCode" VARCHAR(5) NOT NULL,
    "ActivityName" VARCHAR(100) NOT NULL,
    "ActivityDate" TIMESTAMP(3) NOT NULL,
    "ActivityFrom" VARCHAR(10),
    "ActivityTo" VARCHAR(10),
    "Remarks" VARCHAR(100),
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "deletedAt" INTEGER,
    "Status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "ContainerActivity_pkey" PRIMARY KEY ("ContainerActivitySid")
);

-- CreateTable
CREATE TABLE "ContainerActivityMaster" (
    "ContainerActivityMasterSid" SERIAL NOT NULL,
    "TransactionSid" INTEGER NOT NULL,
    "ActivityCode" VARCHAR(5) NOT NULL,
    "ActivityName" VARCHAR(100) NOT NULL,
    "ContainerMoveStatus" VARCHAR(10),
    "MoveType" VARCHAR(10),
    "IsDamageMove" CHAR(1) NOT NULL DEFAULT 'N',
    "Remarks" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CreatedOn" TIMESTAMP(3) NOT NULL,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContainerActivityMaster_pkey" PRIMARY KEY ("ContainerActivityMasterSid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContainerActivityMaster_ActivityCode_key" ON "ContainerActivityMaster"("ActivityCode");

-- AddForeignKey
ALTER TABLE "ContainerActivity" ADD CONSTRAINT "ContainerActivity_ActivityCode_fkey" FOREIGN KEY ("ActivityCode") REFERENCES "ContainerActivityMaster"("ActivityCode") ON DELETE RESTRICT ON UPDATE CASCADE;
