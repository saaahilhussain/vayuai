import express from "express";
import { getEvents, getRecentEvents, getFilteredEvents, getHeatmap, getLocations, streamEvents } from "../controllers/eventController.js";

const router = express.Router();

router.get("/", getEvents);
router.get("/recent", getRecentEvents);
router.get("/filtered", getFilteredEvents);
router.get("/stream", streamEvents);
router.get("/heatmap", getHeatmap);
router.get("/locations", getLocations);

export default router;
