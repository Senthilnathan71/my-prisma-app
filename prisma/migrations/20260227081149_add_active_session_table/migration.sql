-- CreateTable
CREATE TABLE "ActiveSession" (
    "ActiveSessionId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionToken" VARCHAR(64) NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "location" VARCHAR(255),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveSession_pkey" PRIMARY KEY ("ActiveSessionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveSession_userId_key" ON "ActiveSession"("userId");

-- AddForeignKey
ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
