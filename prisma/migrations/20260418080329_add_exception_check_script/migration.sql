-- CreateTable
CREATE TABLE "ExceptionCheckScript" (
    "ExceptionCheckScriptSid" SERIAL NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "ScriptName" VARCHAR(200) NOT NULL,
    "ScriptDescription" VARCHAR(2000),
    "ScriptText" TEXT NOT NULL,
    "ExecutionMode" VARCHAR(10) NOT NULL,
    "Frequency" VARCHAR(10),
    "DayOfWeek" INTEGER,
    "DayOfMonth" INTEGER,
    "ScheduleTime" VARCHAR(5),
    "TimeZone" VARCHAR(50),
    "ToEmails" VARCHAR(1000),
    "CcEmails" VARCHAR(1000),
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "LastRunAt" TIMESTAMPTZ(6),
    "LastRunStatus" VARCHAR(20),
    "LastRunMessage" VARCHAR(500),

    CONSTRAINT "ExceptionCheckScript_pkey" PRIMARY KEY ("ExceptionCheckScriptSid")
);

-- CreateTable
CREATE TABLE "ExceptionCheckScriptRun" (
    "ExceptionCheckScriptRunSid" SERIAL NOT NULL,
    "ExceptionCheckScriptSid" INTEGER NOT NULL,
    "ExecutedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ExecutedBy" VARCHAR(100) NOT NULL,
    "ExecutionMode" VARCHAR(10) NOT NULL,
    "Status" VARCHAR(20) NOT NULL,
    "RowCount" INTEGER,
    "DurationMs" INTEGER,
    "ErrorMessage" VARCHAR(2000),
    "EmailSentTo" VARCHAR(1000),

    CONSTRAINT "ExceptionCheckScriptRun_pkey" PRIMARY KEY ("ExceptionCheckScriptRunSid")
);

-- CreateIndex
CREATE INDEX "ExceptionCheckScript_Status_idx" ON "ExceptionCheckScript"("Status");

-- CreateIndex
CREATE INDEX "ExceptionCheckScript_IsActive_idx" ON "ExceptionCheckScript"("IsActive");

-- CreateIndex
CREATE INDEX "ExceptionCheckScript_ExecutionMode_idx" ON "ExceptionCheckScript"("ExecutionMode");

-- CreateIndex
CREATE INDEX "ExceptionCheckScriptRun_ExceptionCheckScriptSid_ExecutedOn_idx" ON "ExceptionCheckScriptRun"("ExceptionCheckScriptSid", "ExecutedOn" DESC);

-- CreateIndex
CREATE INDEX "ExceptionCheckScriptRun_Status_idx" ON "ExceptionCheckScriptRun"("Status");

-- AddForeignKey
ALTER TABLE "ExceptionCheckScriptRun" ADD CONSTRAINT "ExceptionCheckScriptRun_ExceptionCheckScriptSid_fkey" FOREIGN KEY ("ExceptionCheckScriptSid") REFERENCES "ExceptionCheckScript"("ExceptionCheckScriptSid") ON DELETE CASCADE ON UPDATE CASCADE;
