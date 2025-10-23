/*
  Warnings:

  - You are about to drop the column `BranchMasterSid` on the `AttachDocument` table. All the data in the column will be lost.
  - You are about to drop the column `CompanyMasterSid` on the `AttachDocument` table. All the data in the column will be lost.
  - You are about to drop the column `DocumentSid` on the `AttachDocument` table. All the data in the column will be lost.
  - You are about to drop the column `Documenttype` on the `AttachDocument` table. All the data in the column will be lost.
  - You are about to drop the column `MenuMasterSid` on the `AttachDocument` table. All the data in the column will be lost.
  - You are about to drop the column `Remarks` on the `AttachDocument` table. All the data in the column will be lost.
  - You are about to drop the column `menuName` on the `AttachDocument` table. All the data in the column will be lost.
  - Added the required column `AttachDocumentGroupSid` to the `AttachDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DocumentType` to the `AttachDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `FilePath` to the `AttachDocument` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AttachDocument" DROP CONSTRAINT "AttachDocument_BranchMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "AttachDocument" DROP CONSTRAINT "AttachDocument_CompanyMasterSid_fkey";

-- DropForeignKey
ALTER TABLE "AttachDocument" DROP CONSTRAINT "AttachDocument_MenuMasterSid_fkey";

-- AlterTable
ALTER TABLE "AttachDocument" DROP COLUMN "BranchMasterSid",
DROP COLUMN "CompanyMasterSid",
DROP COLUMN "DocumentSid",
DROP COLUMN "Documenttype",
DROP COLUMN "MenuMasterSid",
DROP COLUMN "Remarks",
DROP COLUMN "menuName",
ADD COLUMN     "AttachDocumentGroupSid" INTEGER NOT NULL,
ADD COLUMN     "DocumentType" VARCHAR(20) NOT NULL,
ADD COLUMN     "FilePath" VARCHAR(500) NOT NULL,
ALTER COLUMN "AttachDocmentNo" DROP NOT NULL,
ALTER COLUMN "DocumentDate" DROP NOT NULL,
ALTER COLUMN "FileName" SET DATA TYPE VARCHAR(100);

-- CreateTable
CREATE TABLE "AttachDocumentGroup" (
    "AttachDocumentGroupSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "MenuMasterSid" INTEGER,
    "MenuName" VARCHAR(50),
    "DocumentSid" INTEGER,
    "DocumentName" VARCHAR(100),
    "Remarks" VARCHAR(500),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedOn" TIMESTAMPTZ(6),
    "updatedBy" VARCHAR(100),
    "deletedAt" TIMESTAMP(3),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "AttachDocumentGroup_pkey" PRIMARY KEY ("AttachDocumentGroupSid")
);

-- AddForeignKey
ALTER TABLE "AttachDocumentGroup" ADD CONSTRAINT "AttachDocumentGroup_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachDocumentGroup" ADD CONSTRAINT "AttachDocumentGroup_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachDocumentGroup" ADD CONSTRAINT "AttachDocumentGroup_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachDocument" ADD CONSTRAINT "AttachDocument_AttachDocumentGroupSid_fkey" FOREIGN KEY ("AttachDocumentGroupSid") REFERENCES "AttachDocumentGroup"("AttachDocumentGroupSid") ON DELETE RESTRICT ON UPDATE CASCADE;
