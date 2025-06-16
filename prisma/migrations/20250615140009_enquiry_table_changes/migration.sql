-- DropForeignKey
ALTER TABLE "EnquiryCargo" DROP CONSTRAINT "EnquiryCargo_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "EnquiryCargo" DROP CONSTRAINT "EnquiryCargo_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "EnquiryHeader" DROP CONSTRAINT "EnquiryHeader_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "EnquiryHeader" DROP CONSTRAINT "EnquiryHeader_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "EnquiryHeader" DROP CONSTRAINT "EnquiryHeader_UserMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "EnquiryRoute" DROP CONSTRAINT "EnquiryRoute_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "EnquiryRoute" DROP CONSTRAINT "EnquiryRoute_CompanyMasterSid_fkey";

-- AlterTable
ALTER TABLE "EnquiryCargo" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL,
ALTER COLUMN "BranchMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EnquiryHeader" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL,
ALTER COLUMN "BranchMasterSid" DROP NOT NULL,
ALTER COLUMN "UserMasterSid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EnquiryRoute" ALTER COLUMN "CompanyMasterSid" DROP NOT NULL,
ALTER COLUMN "BranchMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryHeader" ADD CONSTRAINT "EnquiryHeader_UserMasterSid_fkey" FOREIGN KEY ("UserMasterSid") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRoute" ADD CONSTRAINT "EnquiryRoute_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRoute" ADD CONSTRAINT "EnquiryRoute_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryCargo" ADD CONSTRAINT "EnquiryCargo_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryCargo" ADD CONSTRAINT "EnquiryCargo_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
