import { doubleCsrf } from "csrf-csrf";
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

const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "dev-csrf-secret",
  cookieName: "csrf_token",
  cookieOptions: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
});

router.get("/csrf-token", doubleCsrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.json({ csrfToken: token });
});

router.post("/login", doubleCsrfProtection, login);
router.post("/logout", doubleCsrfProtection, logout);
router.get("/me", doubleCsrfProtection, protect, getCurrentUser);
router.post("/users", doubleCsrfProtection, protect, admin, createAdminUser);

router.post("/initialize", initializeAdminUser);

export default router;
