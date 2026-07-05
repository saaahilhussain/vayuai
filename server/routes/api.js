import express from "express";
import { getEvents, getRecentEvents, getFilteredEvents, getHeatmap, getLocations, streamEvents } from "../controllers/eventController.js";
import { getStats, getTrends, getSensors, getWeather, getHotspots, getPredictions, getMunicipalBrief } from "../controllers/statsController.js";
import { postTweet, postAiWrite } from "../controllers/tweetController.js";
import { simulateBatch, startSimulationAPI, stopSimulationAPI, getSimulationStatus } from "../controllers/simulationController.js";

const router = express.Router();

// Events & Locations
router.get("/events", getEvents);
router.get("/events/recent", getRecentEvents);
router.get("/events/filtered", getFilteredEvents);
router.get("/events/stream", streamEvents);
router.get("/heatmap", getHeatmap);
router.get("/locations", getLocations);

// Stats & AI Engines
router.get("/stats", getStats);
router.get("/trends", getTrends);
router.get("/sensors", getSensors);
router.get("/weather", getWeather);
router.get("/hotspots", getHotspots);
router.get("/predictions", getPredictions);
router.get("/municipal-brief", getMunicipalBrief);

// Submissions
router.post("/tweet", postTweet);
router.post("/ai-write", postAiWrite);

// Simulation
router.post("/simulate", simulateBatch);
router.post("/simulation/start", startSimulationAPI);
router.post("/simulation/stop", stopSimulationAPI);
router.get("/simulation/status", getSimulationStatus);

export default router;
