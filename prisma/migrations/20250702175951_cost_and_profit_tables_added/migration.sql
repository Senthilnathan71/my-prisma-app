-- CreateTable
CREATE TABLE "CostCenterMaster" (
    "CostCenterMasterSid" SERIAL NOT NULL,
    "CostCenterName" VARCHAR(30) NOT NULL,
    "CostCenterCode" VARCHAR(30) NOT NULL,
    "CreatedOn" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "deletedAt" TIMESTAMP(3),
    "Remarks" VARCHAR(100),
    "Status" VARCHAR(10) NOT NULL DEFAULT 'A',

    CONSTRAINT "CostCenterMaster_pkey" PRIMARY KEY ("CostCenterMasterSid")
);

-- CreateTable
CREATE TABLE "ProfitCenterMaster" (
    "ProfitCenterMasterSid" SERIAL NOT NULL,
    "ProfitCenterName" VARCHAR(30) NOT NULL,
    "ProfitCenterCode" VARCHAR(30) NOT NULL,
    "CreatedOn" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "UpdatedBy" VARCHAR(100),
    "Remarks" VARCHAR(100),
    "Status" VARCHAR(10) NOT NULL DEFAULT 'A',

    CONSTRAINT "ProfitCenterMaster_pkey" PRIMARY KEY ("ProfitCenterMasterSid")
);
