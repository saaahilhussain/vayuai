import express from "express";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Test route — returns the authenticated user's info
router.get("/me", verifyToken, (req, res) => {
  res.json({
    message: "You are authenticated!",
    user: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

export default router;
