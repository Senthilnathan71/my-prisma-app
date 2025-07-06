/*
  Warnings:

  - You are about to drop the column `AllowAdd` on the `MenuMaster` table. All the data in the column will be lost.
  - You are about to drop the column `AllowDelete` on the `MenuMaster` table. All the data in the column will be lost.
  - You are about to drop the column `AllowModify` on the `MenuMaster` table. All the data in the column will be lost.
  - You are about to drop the column `AllowView` on the `MenuMaster` table. All the data in the column will be lost.
  - You are about to drop the column `AttachmentRequire` on the `MenuMaster` table. All the data in the column will be lost.
  - You are about to drop the column `FollowupRequire` on the `MenuMaster` table. All the data in the column will be lost.
  - You are about to drop the column `TandCRequire` on the `MenuMaster` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MenuMaster" DROP COLUMN "AllowAdd",
DROP COLUMN "AllowDelete",
DROP COLUMN "AllowModify",
DROP COLUMN "AllowView",
DROP COLUMN "AttachmentRequire",
DROP COLUMN "FollowupRequire",
DROP COLUMN "TandCRequire";

-- CreateTable
CREATE TABLE "MenuPermission" (
    "MenuPermissionSid" SERIAL NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "AllowAdd" CHAR(1) DEFAULT 'Y',
    "AllowView" CHAR(1) DEFAULT 'Y',
    "AllowDelete" CHAR(1) DEFAULT 'Y',
    "AllowModify" CHAR(1) DEFAULT 'N',
    "TandCRequire" CHAR(1) DEFAULT 'N',
    "AttachmentRequire" CHAR(1) DEFAULT 'N',
    "FollowupRequire" CHAR(1) DEFAULT 'N',
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),

    CONSTRAINT "MenuPermission_pkey" PRIMARY KEY ("MenuPermissionSid")
);

-- AddForeignKey
ALTER TABLE "MenuPermission" ADD CONSTRAINT "MenuPermission_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
