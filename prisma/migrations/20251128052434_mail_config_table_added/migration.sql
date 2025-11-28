-- CreateTable
CREATE TABLE "MailConfigurationMaster" (
    "MailConfigurationMasterSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "Sno" DECIMAL(3,0) NOT NULL,
    "MailName" VARCHAR(50) NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "MailSubject" VARCHAR(500) NOT NULL,
    "MailBody" VARCHAR(2000) NOT NULL,
    "ToEmailidFrom" VARCHAR(200) NOT NULL,
    "CcEmailidFrom" VARCHAR(200) NOT NULL,
    "AttachmentRequire" CHAR(1) NOT NULL DEFAULT 'Y',
    "AutoPopup" CHAR(1) NOT NULL DEFAULT 'P',

    CONSTRAINT "MailConfigurationMaster_pkey" PRIMARY KEY ("MailConfigurationMasterSid")
);

-- CreateIndex
CREATE INDEX "fkmailconfig_company" ON "MailConfigurationMaster"("CompanyMasterSid");

-- CreateIndex
CREATE INDEX "fkmailconfig_menu" ON "MailConfigurationMaster"("MenuMasterSid");

-- AddForeignKey
ALTER TABLE "MailConfigurationMaster" ADD CONSTRAINT "MailConfigurationMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailConfigurationMaster" ADD CONSTRAINT "MailConfigurationMaster_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
