import express from "express";
import {
  createAdminUser,
  getCurrentUser,
  initializeAdminUser,
  login,
  logout,
} from "../controllers/authController.js";
import { admin, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/csrf-token", (req, res) => {
  const token = req.csrfToken ? req.csrfToken() : null;
  res.json({ csrfToken: token });
});

router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, getCurrentUser);
router.post("/users", protect, admin, createAdminUser);
router.post("/initialize", initializeAdminUser);

export default router;
