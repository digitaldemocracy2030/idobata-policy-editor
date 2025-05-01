import express from "express";
const router = express.Router();

router.get("/socket-status", (req, res) => {
  const socketEnabled = process.env.SOCKET_ENABLED === "true";
  const socketService = req.app.get("extractionNotificationService");

  res.json({
    socketEnabled,
    serviceAvailable: !!socketService,
    connectedClients:
      socketEnabled && socketService ? socketService.io.engine.clientsCount : 0,
  });
});

export default router;
