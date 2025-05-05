import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { Server } from "socket.io";
import themeRoutes from "./routes/themeRoutes.js"; // Import theme routes
import { callLLM } from "./services/llmService.js"; // Import LLM service

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Database Connection ---
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.warn("Warning: MONGODB_URI is not defined in the .env file.");
  console.warn("Continuing without MongoDB for testing purposes");
}

try {
  await mongoose.connect(mongoUri || "mongodb://localhost:27017/idobata");
  console.log("MongoDB connected successfully.");
} catch (err) {
  console.error("MongoDB connection error:", err);
  console.warn("Continuing without MongoDB for testing purposes");
}

// --- Express App Setup ---
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.IDEA_CORS_ORIGIN
      ? process.env.IDEA_CORS_ORIGIN.split(",")
      : ["http://localhost:5173", "http://localhost:5175"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const PORT = process.env.PORT || 3000; // Use port from env or default to 3000

// --- Middleware ---
// CORS: Allow requests from the frontend development server
app.use(
  cors({
    origin: process.env.IDEA_CORS_ORIGIN
      ? process.env.IDEA_CORS_ORIGIN.split(",")
      : ["http://localhost:5173", "http://localhost:5175"],
    // Add other origins (e.g., production frontend URL) if needed
  })
);

// JSON Parser: Parse incoming JSON requests
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// --- API Routes ---
// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

import authRoutes from "./routes/authRoutes.js"; // 追加: 認証ルート
import likeRoutes from "./routes/likeRoutes.js"; // Import like routes
import questionEmbeddingRoutes from "./routes/questionEmbeddingRoutes.js";
import siteConfigRoutes from "./routes/siteConfigRoutes.js";
import themeChatRoutes from "./routes/themeChatRoutes.js";
import themeDigestRoutes from "./routes/themeDigestRoutes.js";
import themeEmbeddingRoutes from "./routes/themeEmbeddingRoutes.js";
import themeGenerateQuestionsRoutes from "./routes/themeGenerateQuestionsRoutes.js";
import themeImportRoutes from "./routes/themeImportRoutes.js";
import themePolicyRoutes from "./routes/themePolicyRoutes.js";
import themeProblemRoutes from "./routes/themeProblemRoutes.js";
// Import theme-based routes
import themeQuestionRoutes from "./routes/themeQuestionRoutes.js";
import themeSolutionRoutes from "./routes/themeSolutionRoutes.js";
import topPageRoutes from "./routes/topPageRoutes.js"; // Import top page routes
import userRoutes from "./routes/userRoutes.js"; // Import user routes

// Theme management routes
app.use("/api/themes", themeRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/themes/:themeId/questions", themeQuestionRoutes);
app.use("/api/themes/:themeId/problems", themeProblemRoutes);
app.use("/api/themes/:themeId/solutions", themeSolutionRoutes);
app.use(
  "/api/themes/:themeId/generate-questions",
  themeGenerateQuestionsRoutes
);
app.use("/api/themes/:themeId/policy-drafts", themePolicyRoutes);
app.use("/api/themes/:themeId/digest-drafts", themeDigestRoutes);
app.use("/api/themes/:themeId/import", themeImportRoutes);
app.use("/api/themes/:themeId/chat", themeChatRoutes);
app.use("/api/themes/:themeId", themeEmbeddingRoutes);
app.use("/api/questions/:questionId", questionEmbeddingRoutes);

app.use("/api/site-config", siteConfigRoutes);
app.use("/api/top-page-data", topPageRoutes); // Add top page routes
app.use("/api/users", userRoutes);
app.use("/api/likes", likeRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Serve static files in production ---
// This section will be useful when deploying to production
// For development, we'll handle this with a fallback route
if (process.env.NODE_ENV === "production") {
  // Serve static files from the React app build directory
  const frontendBuildPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(frontendBuildPath));

  // For any request that doesn't match an API route, serve the React app
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
}

// For development, add a fallback route to handle non-API requests
app.use((req, res, next) => {
  // If this is an API request, continue to the API routes
  if (req.path.startsWith("/api")) {
    return next();
  }

  const userIdProfileImageRegex = /^\/([0-9a-f-]+)\/profile-image$/;
  const match = req.path.match(userIdProfileImageRegex);
  if (match && req.method === "POST") {
    console.log(
      `Redirecting request from ${req.path} to /api/users${req.path}`
    );
    req.url = `/api/users${req.path}`;
    return next();
  }

  // For all other routes in development, respond with a message
  res.status(200).send(`
<html>
    <head><title>Development Mode</title></head>
    <body>
        <h1>Backend Development Server</h1>
        <p>This is the backend server running in development mode.</p>
        <p>For client-side routing to work properly in development:</p>
        <ul>
            <li>Make sure your frontend Vite dev server is running (npm run dev in the frontend directory)</li>
            <li>Access your app through the Vite dev server URL (typically http://localhost:5173)</li>
            <li>The Vite dev server will proxy API requests to this backend server</li>
        </ul>
    </body>
</html>
`);
});

// --- Error Handling Middleware (Example - Add more specific handlers later) ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// --- Socket.IO Setup ---
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("subscribe-theme", (themeId) => {
    console.log(`Socket ${socket.id} subscribing to theme: ${themeId}`);
    socket.join(`theme:${themeId}`);
  });

  socket.on("subscribe-thread", (threadId) => {
    console.log(`Socket ${socket.id} subscribing to thread: ${threadId}`);
    socket.join(`thread:${threadId}`);
  });

  socket.on("unsubscribe-theme", (themeId) => {
    console.log(`Socket ${socket.id} unsubscribing from theme: ${themeId}`);
    socket.leave(`theme:${themeId}`);
  });

  socket.on("unsubscribe-thread", (threadId) => {
    console.log(`Socket ${socket.id} unsubscribing from thread: ${threadId}`);
    socket.leave(`thread:${threadId}`);
  });

  socket.on("clear-chat-queue", (threadId) => {
    console.log(
      `Socket ${socket.id} clearing chat queue for thread: ${threadId}`
    );
    const ChatThread = mongoose.model("ChatThread");
    ChatThread.findByIdAndUpdate(threadId, { pendingSentences: [] })
      .then(() => {
        console.log(`Cleared pending sentences for thread: ${threadId}`);
      })
      .catch((err) => {
        console.error(
          `Error clearing pending sentences for thread: ${threadId}`,
          err
        );
      });
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

export { io };

// --- Start Server ---
httpServer.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
