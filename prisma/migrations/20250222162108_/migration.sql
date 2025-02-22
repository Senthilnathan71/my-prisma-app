/*
  Warnings:

  - Made the column `leadAssignTo` on table `PreCustomerMaster` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PreCustomerMaster" ALTER COLUMN "leadAssignTo" SET NOT NULL;
