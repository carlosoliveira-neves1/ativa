import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import cors from "cors";
import express from "express";
import { JSONFileSync, LowSync } from "lowdb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbFile = join(__dirname, "db.json");

const defaultData = { responses: {}, syncHistory: [], actionPlans: [] };
const adapter = new JSONFileSync(dbFile);
const db = new LowSync(adapter, defaultData);
db.read();

if (!db.data) {
  db.data = structuredClone(defaultData);
  db.write();
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/state", (_req, res) => {
  db.read();
  const data = db.data ?? structuredClone(defaultData);
  res.json({
    responses: data.responses ?? defaultData.responses,
    syncHistory: data.syncHistory ?? defaultData.syncHistory,
    actionPlans: data.actionPlans ?? defaultData.actionPlans,
  });
});

app.post("/state", (req, res) => {
  const { responses, syncHistory, actionPlans } = req.body ?? {};
  db.data = {
    responses: responses ?? defaultData.responses,
    syncHistory: syncHistory ?? defaultData.syncHistory,
    actionPlans: actionPlans ?? defaultData.actionPlans,
  };
  db.write();
  res.status(204).end();
});

app.post("/sync", (req, res) => {
  const entry = req.body;
  if (!entry?.timestamp) {
    return res.status(400).json({ message: "Invalid sync entry" });
  }
  db.read();
  db.data = db.data ?? structuredClone(defaultData);
  db.data.syncHistory = [entry, ...(db.data.syncHistory ?? [])].slice(0, 50);
  db.write();
  res.status(201).json({ message: "Sync stored" });
});

app.get("/action-plans", (_req, res) => {
  db.read();
  const data = db.data ?? structuredClone(defaultData);
  res.json(data.actionPlans ?? []);
});

app.post("/action-plans", (req, res) => {
  const plan = req.body;
  if (!plan?.id) {
    return res.status(400).json({ message: "Action plan must include an id" });
  }
  db.read();
  db.data = db.data ?? structuredClone(defaultData);
  const plans = db.data.actionPlans ?? [];
  const existingIndex = plans.findIndex((item) => item.id === plan.id);
  if (existingIndex >= 0) {
    plans[existingIndex] = plan;
  } else {
    plans.unshift(plan);
  }
  db.data.actionPlans = plans;
  db.write();
  res.status(201).json(plan);
});

app.delete("/action-plans/:id", (req, res) => {
  const { id } = req.params;
  db.read();
  db.data = db.data ?? structuredClone(defaultData);
  db.data.actionPlans = (db.data.actionPlans ?? []).filter((plan) => plan.id !== id);
  db.write();
  res.status(204).end();
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`Cloud-mock API running on http://localhost:${PORT}`);
  /* eslint-enable no-console */
});
