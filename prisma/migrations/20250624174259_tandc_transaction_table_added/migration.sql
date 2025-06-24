-- CreateTable
CREATE TABLE "TandCTransaction" (
    "TandCTransactionSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "TandCMasterSid" INTEGER NOT NULL,
    "TandCDetailSid" INTEGER NOT NULL,
    "Terms" VARCHAR(1000) NOT NULL,
    "DocumentSid" INTEGER,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "TandCTransaction_pkey" PRIMARY KEY ("TandCTransactionSid")
);

-- CreateTable
CREATE TABLE "FavouriteScreen" (
    "FavScreenId" SERIAL NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "screenName" VARCHAR(100),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(100) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "FavouriteScreen_pkey" PRIMARY KEY ("FavScreenId")
);

-- CreateTable
CREATE TABLE "RecentScreen" (
    "RecentScreenId" SERIAL NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "screenName" VARCHAR(100),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(100) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "RecentScreen_pkey" PRIMARY KEY ("RecentScreenId")
);

-- AddForeignKey
ALTER TABLE "TandCTransaction" ADD CONSTRAINT "TandCTransaction_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TandCTransaction" ADD CONSTRAINT "TandCTransaction_TandCMasterSid_fkey" FOREIGN KEY ("TandCMasterSid") REFERENCES "TermsAndConditionsMaster"("TermsAndConditionsMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TandCTransaction" ADD CONSTRAINT "TandCTransaction_TandCDetailSid_fkey" FOREIGN KEY ("TandCDetailSid") REFERENCES "TermsAndConditionsDetail"("TermsAndConditionsDetailSid") ON DELETE RESTRICT ON UPDATE CASCADE;
