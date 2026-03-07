-- CreateTable
CREATE TABLE "ConditionalLogicRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "targetQuestionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionPayload" JSONB,
    "conditions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConditionalLogicRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConditionalLogicRule_companyId_idx" ON "ConditionalLogicRule"("companyId");

-- CreateIndex
CREATE INDEX "ConditionalLogicRule_sectionId_idx" ON "ConditionalLogicRule"("sectionId");

-- AddForeignKey
ALTER TABLE "ConditionalLogicRule"
  ADD CONSTRAINT "ConditionalLogicRule_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
