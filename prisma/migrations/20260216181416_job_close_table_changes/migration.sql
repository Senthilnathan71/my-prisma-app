-- AlterTable
ALTER TABLE "MasterJobOthers" ADD COLUMN     "AccCloseStatus" VARCHAR(10) DEFAULT 'Open',
ADD COLUMN     "AccClosedBy" VARCHAR(100),
ADD COLUMN     "AccClosedDate" TIMESTAMPTZ(6),
ADD COLUMN     "DocCloseStatus" VARCHAR(10) DEFAULT 'Open',
ADD COLUMN     "DocClosedBy" VARCHAR(100),
ADD COLUMN     "DocClosedDate" TIMESTAMPTZ(6),
ADD COLUMN     "JobCloseStatus" VARCHAR(10) DEFAULT 'Open',
ADD COLUMN     "JobClosedBy" VARCHAR(100),
ADD COLUMN     "JobClosedDate" TIMESTAMPTZ(6),
ADD COLUMN     "OpsCloseStatus" VARCHAR(10) DEFAULT 'Open',
ADD COLUMN     "OpsClosedBy" VARCHAR(100),
ADD COLUMN     "OpsClosedDate" TIMESTAMPTZ(6);
