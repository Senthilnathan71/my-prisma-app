/*
  Warnings:

  - You are about to drop the column `leadReferredOn` on the `PreCustomerMaster` table. All the data in the column will be lost.
  - Added the required column `leadFrom` to the `PreCustomerMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PreCustomerMaster" DROP COLUMN "leadReferredOn",
ADD COLUMN     "leadFrom" VARCHAR(20) NOT NULL;
