import express from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { getCitizenEvents, addFeedback, deleteCitizenEvent } from "../controllers/citizenController.js";

const router = express.Router();

router.use(verifyToken, requireRole(["citizen"]));

router.get("/events", getCitizenEvents);
router.post("/events/:id/feedback", addFeedback);
router.delete("/events/:id", deleteCitizenEvent);

export default router;
