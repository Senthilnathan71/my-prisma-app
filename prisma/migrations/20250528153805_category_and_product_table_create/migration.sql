-- CreateTable
CREATE TABLE "CategoryMaster" (
    "CategoryMasterSId" SERIAL NOT NULL,
    "CategoryCode" VARCHAR(20) NOT NULL,
    "CategoryName" VARCHAR(100) NOT NULL,
    "CategoryType" VARCHAR(10) NOT NULL,
    "SupplierName" VARCHAR(100) NOT NULL,
    "CountryMasterSId" INTEGER,
    "CompanyMasterSId" INTEGER NOT NULL,
    "InventoryMethod" VARCHAR(10),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "CategoryMaster_pkey" PRIMARY KEY ("CategoryMasterSId")
);

-- CreateTable
CREATE TABLE "ProductMaster" (
    "ProductMasterSId" SERIAL NOT NULL,
    "CategoryMasterSId" INTEGER,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "ProductCode" VARCHAR(20) NOT NULL,
    "ProductName" VARCHAR(100) NOT NULL,
    "Product_LL" VARCHAR(100),
    "HSNCode" VARCHAR(10),
    "Description" VARCHAR(200),
    "UOMCode" VARCHAR(10),
    "ProductId" VARCHAR(10),
    "ImcoName" VARCHAR(10),
    "UNo" VARCHAR(5),
    "PackingGroup" VARCHAR(10),
    "ProductType" CHAR(1),
    "UNNo" INTEGER,
    "IMOClass" VARCHAR(5),
    "IMOSubClass" VARCHAR(5),
    "UNPackingCode" VARCHAR(5),
    "FlashPoint" VARCHAR(10),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "ProductMaster_pkey" PRIMARY KEY ("ProductMasterSId")
);

-- AddForeignKey
ALTER TABLE "CategoryMaster" ADD CONSTRAINT "CategoryMaster_CountryMasterSId_fkey" FOREIGN KEY ("CountryMasterSId") REFERENCES "CountryMaster"("CountryMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryMaster" ADD CONSTRAINT "CategoryMaster_CompanyMasterSId_fkey" FOREIGN KEY ("CompanyMasterSId") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_CategoryMasterSId_fkey" FOREIGN KEY ("CategoryMasterSId") REFERENCES "CategoryMaster"("CategoryMasterSId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
