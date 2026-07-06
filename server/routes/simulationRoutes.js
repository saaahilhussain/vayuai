import express from "express";
import { simulateBatch, startSimulationAPI, stopSimulationAPI, getSimulationStatus } from "../controllers/simulationController.js";

const router = express.Router();

router.post("/", simulateBatch);
router.post("/start", startSimulationAPI);
router.post("/stop", stopSimulationAPI);
router.get("/status", getSimulationStatus);

export default router;
