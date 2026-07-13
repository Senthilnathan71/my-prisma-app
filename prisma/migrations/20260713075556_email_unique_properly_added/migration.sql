/*
  Warnings:

  - A unique constraint covering the columns `[LoginEmail]` on the table `CustomerLogin` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userEmail]` on the table `UserMaster` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CustomerLogin_LoginEmail_key" ON "CustomerLogin"("LoginEmail");

-- CreateIndex
CREATE UNIQUE INDEX "UserMaster_userEmail_key" ON "UserMaster"("userEmail");
