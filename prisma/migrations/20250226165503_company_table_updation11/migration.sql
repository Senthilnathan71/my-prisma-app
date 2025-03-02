-- AlterTable
ALTER TABLE "CustomerMaster" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';
