-- CreateTable
CREATE TABLE "MenuConfig" (
    "menuConfigSid" SERIAL NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "ModelName" VARCHAR(50) NOT NULL,
    "PrimaryKey" VARCHAR(50) NOT NULL,
    "LinkPattern" VARCHAR(100) NOT NULL,
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),

    CONSTRAINT "MenuConfig_pkey" PRIMARY KEY ("menuConfigSid")
);

-- AddForeignKey
ALTER TABLE "MenuConfig" ADD CONSTRAINT "MenuConfig_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE CASCADE ON UPDATE CASCADE;
