import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

app.use("/api", router);

// ── Serve AI Persona Studio at /studio ───────────────────────────────────────
const aiPersonaDist = path.resolve(process.cwd(), "..", "ai-persona", "dist", "public");
if (fs.existsSync(aiPersonaDist)) {
  app.use("/studio", express.static(aiPersonaDist, { index: "index.html" }));
  app.get("/studio/{*path}", (_req, res) => {
    res.sendFile(path.join(aiPersonaDist, "index.html"));
  });
}

// ── Serve built frontend (single-port deployment) ────────────────────────────
// In production, the built admin portal lives at ../hannah-brooks/dist/public
const frontendDist = path.resolve(process.cwd(), "..", "hannah-brooks", "dist", "public");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: "index.html" }));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => res.json({ status: "ok", message: "Hannah Brooks API — build the frontend and it will be served here" }));
}

export default app;
