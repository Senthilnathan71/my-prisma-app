/*
  Warnings:

  - You are about to drop the `ContainerMaster` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ContainerMaster" DROP CONSTRAINT "ContainerMaster_CompanyMasterSid_fkey";

-- DropTable
DROP TABLE "ContainerMaster";
