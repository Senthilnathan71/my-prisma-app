/*
  Warnings:

  - You are about to drop the column `AllowAdd` on the `MenuPermission` table. All the data in the column will be lost.
  - You are about to drop the column `AllowDelete` on the `MenuPermission` table. All the data in the column will be lost.
  - You are about to drop the column `AllowModify` on the `MenuPermission` table. All the data in the column will be lost.
  - You are about to drop the column `AllowView` on the `MenuPermission` table. All the data in the column will be lost.
  - You are about to drop the column `AttachmentRequire` on the `MenuPermission` table. All the data in the column will be lost.
  - You are about to drop the column `FollowupRequire` on the `MenuPermission` table. All the data in the column will be lost.
  - You are about to drop the column `TandCRequire` on the `MenuPermission` table. All the data in the column will be lost.
  - Added the required column `permissionName` to the `MenuPermission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MenuPermission" DROP COLUMN "AllowAdd",
DROP COLUMN "AllowDelete",
DROP COLUMN "AllowModify",
DROP COLUMN "AllowView",
DROP COLUMN "AttachmentRequire",
DROP COLUMN "FollowupRequire",
DROP COLUMN "TandCRequire",
ADD COLUMN     "permissionCode" VARCHAR(100),
ADD COLUMN     "permissionName" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "RoleMenuMaster" ADD COLUMN     "MenuPermissions" JSONB;
