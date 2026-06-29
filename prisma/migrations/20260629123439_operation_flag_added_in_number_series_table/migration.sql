-- AlterTable
ALTER TABLE "NumberSeriesConfig" ADD COLUMN     "OperationCode" VARCHAR(10),
ADD COLUMN     "OperationFlagRequired" CHAR(1) NOT NULL DEFAULT 'N',
ADD COLUMN     "POLPODMode" VARCHAR(5) NOT NULL DEFAULT 'BOTH';
