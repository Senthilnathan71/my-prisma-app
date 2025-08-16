-- AlterTable
ALTER TABLE "BranchMaster" ADD COLUMN     "consoleNoLen" INTEGER,
ADD COLUMN     "consolePrefix" VARCHAR(20),
ADD COLUMN     "enquiryNoLen" INTEGER,
ADD COLUMN     "enquiryPrefix" VARCHAR(20),
ADD COLUMN     "quotationNoLen" INTEGER,
ADD COLUMN     "quotationPrefix" VARCHAR(20),
ADD COLUMN     "shipmentNoLen" INTEGER,
ADD COLUMN     "shipmentPrefix" VARCHAR(20);
