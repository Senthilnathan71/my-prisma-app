-- CreateTable
CREATE TABLE "UserLoginHistory" (
    "UserLoginHistoryId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "location" TEXT,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserLoginHistory_pkey" PRIMARY KEY ("UserLoginHistoryId")
);

-- AddForeignKey
ALTER TABLE "UserLoginHistory" ADD CONSTRAINT "UserLoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
