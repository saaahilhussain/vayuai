import express from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import {
  getAssignments,
  updateAssignmentStatus,
  verifyEvent,
  getProfile,
  updateProfile
} from "../controllers/workerController.js";

const router = express.Router();

// All worker routes require authentication + worker role
router.use(verifyToken, requireRole(["worker"]));

router.get("/assignments", getAssignments);
router.patch("/events/:id/status", updateAssignmentStatus);
router.post("/events/:id/verify", verifyEvent);
router.get("/profile", getProfile);
router.patch("/profile", updateProfile);

export default router;
