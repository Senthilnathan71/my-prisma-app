-- CreateTable
CREATE TABLE "UOMMaster" (
    "UOMMasterSid" SERIAL NOT NULL,
    "UOMCode" VARCHAR(3) NOT NULL,
    "UOMName" VARCHAR(20) NOT NULL,
    "UOMType" VARCHAR(10) NOT NULL,
    "EdiCode" CHAR(3),
    "DimensionReq" CHAR(1) NOT NULL,
    "WeightReq" CHAR(1) NOT NULL,
    "VolumeReq" CHAR(1) NOT NULL,
    "ShipmentType" VARCHAR(5) NOT NULL,
    "CostPerUnitPrice" DECIMAL(10,5) NOT NULL,
    "SlabFrom" DECIMAL(4,0) NOT NULL,
    "SlabTo" DECIMAL(4,0) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) NOT NULL DEFAULT 'A',
    "Remarks" VARCHAR(300),

    CONSTRAINT "UOMMaster_pkey" PRIMARY KEY ("UOMMasterSid")
);

-- CreateIndex
CREATE UNIQUE INDEX "UOMMaster_UOMCode_key" ON "UOMMaster"("UOMCode");

-- CreateIndex
CREATE UNIQUE INDEX "UOMMaster_UOMName_key" ON "UOMMaster"("UOMName");

-- CreateIndex
CREATE INDEX "UOMMaster_status_idx" ON "UOMMaster"("status");
