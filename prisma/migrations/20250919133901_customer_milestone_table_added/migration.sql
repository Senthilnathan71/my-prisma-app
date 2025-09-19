-- CreateTable
CREATE TABLE "CustomerMilestone" (
    "CustomerMilestoneSid" SERIAL NOT NULL,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "MilestoneMasterSid" INTEGER NOT NULL,
    "UpdateType" VARCHAR(10) NOT NULL,
    "ContactInfo" VARCHAR(100) NOT NULL,
    "EffectiveFrom" DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT "CustomerMilestone_pkey" PRIMARY KEY ("CustomerMilestoneSid")
);

-- AddForeignKey
ALTER TABLE "CustomerMilestone" ADD CONSTRAINT "CustomerMilestone_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMilestone" ADD CONSTRAINT "CustomerMilestone_MilestoneMasterSid_fkey" FOREIGN KEY ("MilestoneMasterSid") REFERENCES "MilestoneMaster"("MilestoneMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
