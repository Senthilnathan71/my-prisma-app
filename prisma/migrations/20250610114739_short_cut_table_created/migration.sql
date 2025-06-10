-- CreateTable
CREATE TABLE "ShortCut" (
    "shortCutId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" VARCHAR(20) NOT NULL,
    "description" VARCHAR(50),
    "link" TEXT NOT NULL,
    "useRouter" BOOLEAN NOT NULL DEFAULT false,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShortCut_pkey" PRIMARY KEY ("shortCutId")
);

-- AddForeignKey
ALTER TABLE "ShortCut" ADD CONSTRAINT "ShortCut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
