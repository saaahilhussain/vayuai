import express from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import {
  listEvents,
  updateEventStatus,
  assignWorker,
  deleteEvent,
  listWorkers,
  updateWorkerStatus,
  getDashboard,
} from "../controllers/municipalityController.js";

const router = express.Router();

// All municipality routes require authentication + municipality role
router.use(verifyToken, requireRole(["municipality"]));

router.get("/dashboard", getDashboard);
router.get("/events", listEvents);
router.get("/workers", listWorkers);
router.patch("/workers/:uid/status", updateWorkerStatus);
router.patch("/events/:id/status", updateEventStatus);
router.patch("/events/:id/assign", assignWorker);
router.delete("/events/:id", deleteEvent);

export default router;
