/*
  Warnings:

  - Added the required column `VoyageMasterHeaderSid` to the `VoyageMasterDetail` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VoyageMasterDetail" ADD COLUMN     "VoyageMasterHeaderSid" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "VoyageMasterDetail" ADD CONSTRAINT "VoyageMasterDetail_VoyageMasterHeaderSid_fkey" FOREIGN KEY ("VoyageMasterHeaderSid") REFERENCES "VoyageMasterHeader"("VoyageMasterHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
