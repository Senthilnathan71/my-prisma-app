-- CreateTable
CREATE TABLE "PublicAccessToken" (
    "PublicAccessTokenSid" SERIAL NOT NULL,
    "Token" VARCHAR(80) NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "ResourceSid" INTEGER NOT NULL,
    "ExpiresAt" TIMESTAMPTZ(6) NOT NULL,
    "UsedAt" TIMESTAMPTZ(6),
    "SentToEmail" VARCHAR(200),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100),
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "PublicAccessToken_pkey" PRIMARY KEY ("PublicAccessTokenSid")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicAccessToken_Token_key" ON "PublicAccessToken"("Token");

-- CreateIndex
CREATE INDEX "PublicAccessToken_MenuMasterSid_ResourceSid_idx" ON "PublicAccessToken"("MenuMasterSid", "ResourceSid");

-- CreateIndex
CREATE INDEX "PublicAccessToken_ExpiresAt_idx" ON "PublicAccessToken"("ExpiresAt");

-- AddForeignKey
ALTER TABLE "PublicAccessToken" ADD CONSTRAINT "PublicAccessToken_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
