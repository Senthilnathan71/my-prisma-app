-- AlterTable
ALTER TABLE "PreCustomerMeeting" ALTER COLUMN "meetingStatus" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "QuoteCharge" ALTER COLUMN "CostNumberOfUnit" SET DATA TYPE DECIMAL(7,3),
ALTER COLUMN "RevenueNumberOfUnit" SET DATA TYPE DECIMAL(7,3);
