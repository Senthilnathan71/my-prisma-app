-- AlterTable
ALTER TABLE "CurrencyMaster" ADD COLUMN     "GroupSeparator" VARCHAR(10) DEFAULT 'Comma',
ADD COLUMN     "GroupingStyle" VARCHAR(20) DEFAULT 'International';
