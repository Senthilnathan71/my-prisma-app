/*
  Warnings:

  - The `department` column on the `UserMaster` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `userTypeId` to the `UserMaster` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserTypeCode" AS ENUM ('admin', 'manager', 'teamLead', 'user');

-- AlterTable
ALTER TABLE "UserMaster" ADD COLUMN     "userTypeId" INTEGER NOT NULL,
DROP COLUMN "department",
ADD COLUMN     "department" VARCHAR(500)[];

-- CreateTable
CREATE TABLE "UserType" (
    "UserTypeSid" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" "UserTypeCode" NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserType_pkey" PRIMARY KEY ("UserTypeSid")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserType_name_key" ON "UserType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserType_code_key" ON "UserType"("code");

-- AddForeignKey
ALTER TABLE "UserMaster" ADD CONSTRAINT "UserMaster_userTypeId_fkey" FOREIGN KEY ("userTypeId") REFERENCES "UserType"("UserTypeSid") ON DELETE RESTRICT ON UPDATE CASCADE;
