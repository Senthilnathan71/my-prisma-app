/*
  Warnings:

  - The primary key for the `VoyageMasterHeader` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `VoyageMaserSid` on the `VoyageMasterHeader` table. All the data in the column will be lost.
  - Changed the type of `BookingHeaderSid` on the `BookingCargo` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "BookingCargo" DROP COLUMN "BookingHeaderSid",
ADD COLUMN     "BookingHeaderSid" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "VoyageMasterHeader" DROP CONSTRAINT "VoyageMasterHeader_pkey",
DROP COLUMN "VoyageMaserSid",
ADD COLUMN     "VoyageMasterHeaderSid" SERIAL NOT NULL,
ADD CONSTRAINT "VoyageMasterHeader_pkey" PRIMARY KEY ("VoyageMasterHeaderSid");

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHeader" ADD CONSTRAINT "BookingHeader_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCargo" ADD CONSTRAINT "BookingCargo_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCargo" ADD CONSTRAINT "BookingCargo_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCargo" ADD CONSTRAINT "BookingCargo_BookingHeaderSid_fkey" FOREIGN KEY ("BookingHeaderSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoyageMasterHeader" ADD CONSTRAINT "VoyageMasterHeader_VesselMasterSid_fkey" FOREIGN KEY ("VesselMasterSid") REFERENCES "VesselMaster"("VesselMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
