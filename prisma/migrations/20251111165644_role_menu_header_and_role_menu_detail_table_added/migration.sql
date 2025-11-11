-- CreateTable
CREATE TABLE "RoleMenuHeader" (
    "RoleMenuHeaderSid" SERIAL NOT NULL,
    "RoleMasterSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(100) NOT NULL,

    CONSTRAINT "RoleMenuHeader_pkey" PRIMARY KEY ("RoleMenuHeaderSid")
);

-- CreateTable
CREATE TABLE "RoleMenuDetail" (
    "RoleMenuDetailSid" SERIAL NOT NULL,
    "RoleMenuHeaderSid" INTEGER NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "DisplayName" TEXT,
    "CompanyMasterSid" INTEGER,
    "InsertRole" CHAR(1) DEFAULT 'N',
    "ViewRole" CHAR(1) DEFAULT 'N',
    "UpdateRole" CHAR(1) DEFAULT 'N',
    "DeleteRole" CHAR(1) DEFAULT 'N',
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "ModuleAndMenus" JSONB NOT NULL,

    CONSTRAINT "RoleMenuDetail_pkey" PRIMARY KEY ("RoleMenuDetailSid")
);

-- AddForeignKey
ALTER TABLE "RoleMenuHeader" ADD CONSTRAINT "RoleMenuHeader_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuHeader" ADD CONSTRAINT "RoleMenuHeader_RoleMasterSid_fkey" FOREIGN KEY ("RoleMasterSid") REFERENCES "RoleMaster"("RoleMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuDetail" ADD CONSTRAINT "RoleMenuDetail_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuDetail" ADD CONSTRAINT "RoleMenuDetail_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuDetail" ADD CONSTRAINT "RoleMenuDetail_RoleMenuHeaderSid_fkey" FOREIGN KEY ("RoleMenuHeaderSid") REFERENCES "RoleMenuHeader"("RoleMenuHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
