import "dotenv/config";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_QUESTIONNAIRE = "default";
const MAX_SYNC_HISTORY = 50;

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

function normalizeValue(record) {
  if (record.valueNumber !== null && record.valueNumber !== undefined) {
    return record.valueNumber;
  }
  if (record.valueString !== null && record.valueString !== undefined) {
    return record.valueString;
  }
  return undefined;
}

function mapActionPlan(plan) {
  return {
    id: plan.id,
    title: plan.title,
    problemDescription: plan.problemDescription,
    normativeItem: plan.normativeItem ?? "",
    unitOrSector: plan.unitOrSector ?? "",
    correctiveAction: plan.correctiveAction,
    severity: plan.severity,
    status: plan.status,
    dueDate: plan.dueDate ? plan.dueDate.toISOString() : "",
    responsible: plan.responsible,
    notes: plan.notes ?? undefined,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

app.get("/state", async (_req, res) => {
  try {
    const [responseRows, syncRows, planRows] = await Promise.all([
      prisma.questionResponse.findMany({
        where: { questionnaire: DEFAULT_QUESTIONNAIRE },
      }),
      prisma.syncEntry.findMany({
        orderBy: { timestamp: "desc" },
      }),
      prisma.actionPlan.findMany({
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const responses = {};
    for (const record of responseRows) {
      if (!responses[record.sectionId]) {
        responses[record.sectionId] = {};
      }
      const entry = {};
      const value = normalizeValue(record);
      if (value !== undefined) {
        entry.value = value;
      }
      if (record.attachmentName) {
        entry.attachmentName = record.attachmentName;
      }
      if (record.attachmentData) {
        entry.attachmentData = record.attachmentData;
      }
      responses[record.sectionId][record.questionId] = entry;
    }

    const syncHistory = syncRows.map((item) => ({
      timestamp: item.timestamp.toISOString(),
      conformity: item.conformity,
      completion: item.completion,
      note: item.note ?? undefined,
    }));

    const actionPlans = planRows.map(mapActionPlan);

    res.json({ responses, syncHistory, actionPlans });
  } catch (error) {
    console.error("Failed to fetch state", error);
    res.status(500).json({ message: "Failed to fetch state" });
  }
});

app.post("/state", async (req, res) => {
  const { responses = {}, syncHistory = [], actionPlans = [] } = req.body ?? {};

  try {
    const responseRows = [];
    for (const [sectionId, sectionResponses] of Object.entries(responses)) {
      if (!sectionResponses || typeof sectionResponses !== "object") {
        continue;
      }
      for (const [questionId, response] of Object.entries(sectionResponses)) {
        if (!response || typeof response !== "object") {
          continue;
        }
        const value = response.value;
        responseRows.push({
          questionnaire: DEFAULT_QUESTIONNAIRE,
          sectionId,
          questionId,
          valueNumber: typeof value === "number" ? value : undefined,
          valueString: typeof value === "string" ? value : undefined,
          attachmentName: response.attachmentName ?? undefined,
          attachmentData: response.attachmentData ?? undefined,
        });
      }
    }

    const syncRows = syncHistory.map((item) => ({
      timestamp: toDate(item.timestamp) ?? new Date(),
      conformity: Number(item.conformity) || 0,
      completion: Number(item.completion) || 0,
      note: item.note ?? undefined,
    }));

    const planRows = actionPlans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      problemDescription: plan.problemDescription,
      normativeItem: plan.normativeItem || undefined,
      unitOrSector: plan.unitOrSector || undefined,
      correctiveAction: plan.correctiveAction,
      severity: plan.severity,
      status: plan.status,
      dueDate: toDate(plan.dueDate),
      responsible: plan.responsible,
      notes: plan.notes || undefined,
      createdAt: toDate(plan.createdAt) ?? new Date(),
    }));

    await prisma.$transaction(async (tx) => {
      await tx.questionResponse.deleteMany({ where: { questionnaire: DEFAULT_QUESTIONNAIRE } });
      if (responseRows.length > 0) {
        await tx.questionResponse.createMany({ data: responseRows });
      }

      await tx.syncEntry.deleteMany();
      if (syncRows.length > 0) {
        await tx.syncEntry.createMany({ data: syncRows });
      }

      await tx.actionPlan.deleteMany();
      if (planRows.length > 0) {
        await tx.actionPlan.createMany({ data: planRows });
      }
    });

    res.status(204).end();
  } catch (error) {
    console.error("Failed to persist state", error);
    res.status(500).json({ message: "Failed to persist state" });
  }
});

app.post("/sync", async (req, res) => {
  const entry = req.body;
  if (!entry?.timestamp) {
    return res.status(400).json({ message: "Invalid sync entry" });
  }

  try {
    await prisma.syncEntry.create({
      data: {
        timestamp: toDate(entry.timestamp) ?? new Date(),
        conformity: Number(entry.conformity) || 0,
        completion: Number(entry.completion) || 0,
        note: entry.note ?? undefined,
      },
    });

    const overflow = await prisma.syncEntry.findMany({
      orderBy: { timestamp: "desc" },
      skip: MAX_SYNC_HISTORY,
      select: { id: true },
    });

    if (overflow.length > 0) {
      await prisma.syncEntry.deleteMany({
        where: { id: { in: overflow.map((item) => item.id) } },
      });
    }

    res.status(201).json({ message: "Sync stored" });
  } catch (error) {
    console.error("Failed to append sync entry", error);
    res.status(500).json({ message: "Failed to append sync entry" });
  }
});

app.get("/action-plans", async (_req, res) => {
  try {
    const plans = await prisma.actionPlan.findMany({
      orderBy: { updatedAt: "desc" },
    });
    res.json(plans.map(mapActionPlan));
  } catch (error) {
    console.error("Failed to list action plans", error);
    res.status(500).json({ message: "Failed to list action plans" });
  }
});

app.post("/action-plans", async (req, res) => {
  const plan = req.body;
  if (!plan?.id) {
    return res.status(400).json({ message: "Action plan must include an id" });
  }

  try {
    const createData = {
      id: plan.id,
      title: plan.title,
      problemDescription: plan.problemDescription,
      normativeItem: plan.normativeItem || undefined,
      unitOrSector: plan.unitOrSector || undefined,
      correctiveAction: plan.correctiveAction,
      severity: plan.severity,
      status: plan.status,
      dueDate: toDate(plan.dueDate),
      responsible: plan.responsible,
      notes: plan.notes || undefined,
      createdAt: toDate(plan.createdAt) ?? undefined,
    };

    const updateData = {
      title: plan.title,
      problemDescription: plan.problemDescription,
      normativeItem: plan.normativeItem || undefined,
      unitOrSector: plan.unitOrSector || undefined,
      correctiveAction: plan.correctiveAction,
      severity: plan.severity,
      status: plan.status,
      dueDate: toDate(plan.dueDate),
      responsible: plan.responsible,
      notes: plan.notes || undefined,
    };

    const saved = await prisma.actionPlan.upsert({
      where: { id: plan.id },
      create: createData,
      update: updateData,
    });

    res.status(201).json(mapActionPlan(saved));
  } catch (error) {
    console.error("Failed to persist action plan", error);
    res.status(500).json({ message: "Failed to persist action plan" });
  }
});

app.delete("/action-plans/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.actionPlan.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(204).end();
    }
    console.error("Failed to remove action plan", error);
    res.status(500).json({ message: "Failed to remove action plan" });
  }
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`Cloud API running on http://localhost:${PORT}`);
  /* eslint-enable no-console */
});

async function shutdown() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error during Prisma disconnect", error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
