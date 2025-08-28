-- AlterTable
ALTER TABLE "VoyageMasterDetail" ADD COLUMN     "Sno" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ContainerActivityNextActivity" (
    "ContainerActivityNextActivitySid" SERIAL NOT NULL,
    "ContainerActivityMasterSid" INTEGER NOT NULL,
    "ActivityCode" VARCHAR(5) NOT NULL,

    CONSTRAINT "ContainerActivityNextActivity_pkey" PRIMARY KEY ("ContainerActivityNextActivitySid")
);

-- AddForeignKey
ALTER TABLE "ContainerActivityNextActivity" ADD CONSTRAINT "ContainerActivityNextActivity_ContainerActivityMasterSid_fkey" FOREIGN KEY ("ContainerActivityMasterSid") REFERENCES "ContainerActivityMaster"("ContainerActivityMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
