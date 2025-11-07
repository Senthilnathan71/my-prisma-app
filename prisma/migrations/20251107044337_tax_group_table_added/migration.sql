-- AlterTable
ALTER TABLE "HSSACMaster" ADD COLUMN     "TaxGroupSid" INTEGER;

-- AlterTable
ALTER TABLE "TaxMaster" ADD COLUMN     "TaxCategory" VARCHAR(10),
ADD COLUMN     "TaxGroupSid" INTEGER;

-- CreateTable
CREATE TABLE "TaxGroup" (
    "TaxGroupSid" SERIAL NOT NULL,
    "TaxGroup" VARCHAR(10) NOT NULL,
    "TaxRate" DECIMAL(4,2) NOT NULL,
    "CreatedOn" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',

    CONSTRAINT "TaxGroup_pkey" PRIMARY KEY ("TaxGroupSid")
);

-- CreateIndex
CREATE INDEX "TaxGroup_Status_idx" ON "TaxGroup"("Status");

-- AddForeignKey
ALTER TABLE "HSSACMaster" ADD CONSTRAINT "HSSACMaster_TaxGroupSid_fkey" FOREIGN KEY ("TaxGroupSid") REFERENCES "TaxGroup"("TaxGroupSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxMaster" ADD CONSTRAINT "TaxMaster_TaxGroupSid_fkey" FOREIGN KEY ("TaxGroupSid") REFERENCES "TaxGroup"("TaxGroupSid") ON DELETE SET NULL ON UPDATE CASCADE;
