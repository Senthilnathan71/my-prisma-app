/*
  Warnings:

  - Added the required column `ModuleCode` to the `ModuleMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ModuleMaster" ADD COLUMN     "ModuleCode" VARCHAR(20) NOT NULL;
