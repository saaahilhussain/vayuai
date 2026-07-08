// VayuAI Express Server — REST API + SSE for real-time streaming

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./routes/api.js";
import { seedHistoricalData, startSimulationFunc } from "./controllers/simulationController.js";
import { store } from "./services/shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || "default_secret"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Mount API routes
app.use("/api", apiRoutes);

// --- Serve static files (production) ---
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

// Serve images from public folder
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images")),
);

// SPA catch-all — must be after all API routes
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// --- Start ---
// Initialize Firestore store, then seed only if empty
store.init().then(() => {
  if (store.getAll().length === 0) {
    console.log("🌱 No existing events in Firestore, seeding historical data...");
    seedHistoricalData().then(() => startSimulationFunc());
  } else {
    console.log(`♻️  Loaded ${store.getAll().length} persisted events, skipping seed.`);
    startSimulationFunc();
  }
});

app.listen(PORT, () => {
  console.log(`\n🌫️ VayuAI Server running on http://localhost:${PORT}`);
  console.log(`📡 SSE stream: http://localhost:${PORT}/api/events/stream`);
  console.log(`🗺️  Events: http://localhost:${PORT}/api/events\n`);
});
