import express from "express";
import {
  createAdminUser,
  getCurrentUser,
  getAdminCount,
  initializeAdminUser,
  login,
} from "../controllers/authController.js";
import { admin, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", protect, getCurrentUser);
router.post("/users", protect, admin, createAdminUser);
router.post("/initialize", initializeAdminUser);
router.get("/count", getAdminCount);

export default router;
