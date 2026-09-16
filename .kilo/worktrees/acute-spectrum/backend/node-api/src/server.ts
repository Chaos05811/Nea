import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cron from "node-cron";

import authRoutes from "./routes/auth";
import sessionRoutes from "./routes/sessions";
import chatRoutes from "./routes/chat";
import voiceRoutes from "./routes/voice";
import memoryRoutes from "./routes/memory";
import { consolidateAllDueUsers, decayTraits } from "./services/capsule";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));

// Generous but real rate limit — this app talks to people in crisis; we never want
// a burst of legitimate messages to get silently dropped.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (_req, res) => res.json({ status: "ok", service: "nea-core-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/memory", memoryRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`nea-core-api listening on :${port}`);
});

// Daily capsule consolidation + trait decay — ported from ai-service's APScheduler job
// (Python) to node-cron. Runs at 3am server time, same as before.
cron.schedule("0 3 * * *", async () => {
  try {
    const created = await consolidateAllDueUsers();
    console.log(`Daily capsule consolidation: ${created.length} capsule(s) created`);
    const decayed = await decayTraits();
    console.log(`Daily trait decay: ${decayed} trait score(s) updated`);
  } catch (err) {
    console.error("Daily consolidation/decay job failed:", err);
  }
});
