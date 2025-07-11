-- CreateTable
CREATE TABLE "TaxMaster" (
    "TaxMasterSid" SERIAL NOT NULL,
    "TaxCode" VARCHAR(10) NOT NULL,
    "TaxName" VARCHAR(20) NOT NULL,
    "TaxType" VARCHAR(6) NOT NULL,
    "EffectiveFrom" DATE NOT NULL,
    "TaxRate" DECIMAL(4,2) NOT NULL,
    "TaxExempt" CHAR(1) NOT NULL DEFAULT 'N',
    "CreatedOn" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Remarks" VARCHAR(100),
    "Status" VARCHAR(10) NOT NULL DEFAULT 'A',

    CONSTRAINT "TaxMaster_pkey" PRIMARY KEY ("TaxMasterSid")
);
