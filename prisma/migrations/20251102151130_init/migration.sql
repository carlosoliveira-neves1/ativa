-- CreateTable
CREATE TABLE "QuestionResponse" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionnaire" TEXT NOT NULL DEFAULT '',
    "valueString" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "attachmentName" TEXT,
    "attachmentData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEntry" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "conformity" DOUBLE PRECISION NOT NULL,
    "completion" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problemDescription" TEXT NOT NULL,
    "normativeItem" TEXT,
    "unitOrSector" TEXT,
    "correctiveAction" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "responsible" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionResponse_sectionId_idx" ON "QuestionResponse"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "responses_question_unique" ON "QuestionResponse"("questionnaire", "sectionId", "questionId");

-- CreateIndex
CREATE INDEX "ActionPlan_status_idx" ON "ActionPlan"("status");

-- CreateIndex
CREATE INDEX "ActionPlan_severity_idx" ON "ActionPlan"("severity");
