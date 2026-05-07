-- AlterTable
ALTER TABLE "HouseJobBOE" ALTER COLUMN "TransactionType" SET DATA TYPE VARCHAR(200);

-- AlterTable
ALTER TABLE "UserMaster" ADD COLUMN     "AttemptDateTime" TIMESTAMPTZ(6);
