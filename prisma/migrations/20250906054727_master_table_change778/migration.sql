-- AddForeignKey
ALTER TABLE "ContainerActivity" ADD CONSTRAINT "ContainerActivity_JobMasterSid_fkey" FOREIGN KEY ("JobMasterSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE RESTRICT ON UPDATE CASCADE;
