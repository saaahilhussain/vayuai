import express from "express";
import { getStats, getTrends, getSensors, getWeather, getHotspots, getPredictions, getMunicipalBrief } from "../controllers/statsController.js";

const router = express.Router();

router.get("/stats", getStats);
router.get("/trends", getTrends);
router.get("/sensors", getSensors);
router.get("/weather", getWeather);
router.get("/hotspots", getHotspots);
router.get("/predictions", getPredictions);
router.get("/municipal-brief", getMunicipalBrief);

export default router;
