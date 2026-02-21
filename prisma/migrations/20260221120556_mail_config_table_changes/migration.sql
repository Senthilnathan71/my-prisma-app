/*
  Warnings:

  - Added the required column `Action` to the `MailConfigurationMaster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Trigger` to the `MailConfigurationMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MailConfigurationMaster" ADD COLUMN     "Action" VARCHAR(200) NOT NULL,
ADD COLUMN     "Trigger" VARCHAR(50) NOT NULL,
ALTER COLUMN "Sno" SET DATA TYPE INTEGER;
