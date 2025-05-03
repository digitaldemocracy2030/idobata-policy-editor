import express from "express";
import {
  createAdminUser,
  getCurrentUser,
  getGoogleAuthUrl,
  googleCallback,
  initializeAdminUser,
  login,
  logout,
} from "../controllers/authController.js";
import { admin, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", protect, getCurrentUser);
router.post("/users", protect, admin, createAdminUser);
router.post("/initialize", initializeAdminUser);
router.get("/google/url", getGoogleAuthUrl);
router.get("/google/callback", googleCallback);
router.post("/logout", protect, logout);

export default router;
