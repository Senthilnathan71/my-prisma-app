-- AlterTable
ALTER TABLE "BookingCro" ADD COLUMN     "EmptySurveyDate" DATE;

-- AlterTable
ALTER TABLE "HouseJobOthers" ADD COLUMN     "ClearanceDate" DATE;

-- AlterTable
ALTER TABLE "MilestoneMaster" ADD COLUMN     "IsCustomerSpecific" CHAR(1) NOT NULL DEFAULT 'N';

-- AlterTable
ALTER TABLE "ReportMaster" ADD COLUMN     "Notes" VARCHAR(5000);
