import express from "express";
import eventRoutes from "./eventRoutes.js";
import statsRoutes from "./statsRoutes.js";
import simulationRoutes from "./simulationRoutes.js";
import authRoutes from "./authRoutes.js";
import municipalityRoutes from "./municipalityRoutes.js";
import workerRoutes from "./workerRoutes.js";
import citizenRoutes from "./citizenRoutes.js";
import { postTweet, postAiWrite } from "../controllers/tweetController.js";
import { postVoiceTweet } from "../controllers/voiceController.js";
import { getHeatmap, getLocations } from "../controllers/eventController.js";

const router = express.Router();

// Mount sub-routers
router.use("/events", eventRoutes);
router.use("/", statsRoutes);
router.use("/simulation", simulationRoutes);
router.use("/auth", authRoutes);
router.use("/municipality", municipalityRoutes);
router.use("/worker", workerRoutes);
router.use("/citizen", citizenRoutes);

// Top-level endpoints the frontend expects at /api/heatmap and /api/locations
router.get("/heatmap", getHeatmap);
router.get("/locations", getLocations);

// Submissions
router.post("/tweet", postTweet);
router.post("/ai-write", postAiWrite);
router.post("/voice", postVoiceTweet);

export default router;
