import express from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { getCitizenEvents, addFeedback } from "../controllers/citizenController.js";

const router = express.Router();

router.use(verifyToken, requireRole(["citizen"]));

router.get("/events", getCitizenEvents);
router.post("/events/:id/feedback", addFeedback);

export default router;
