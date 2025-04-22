import express from 'express';
import { handleNewMessage, getThreadExtractions, getThreadMessages } from '../controllers/chatController.js'; // Import the controllers

const router = express.Router();

// Route for handling new chat messages
// POST /api/chat/messages
router.post('/messages', handleNewMessage);

// Route for getting extractions for a specific thread
// GET /api/chat/threads/:threadId/extractions
router.get('/threads/:threadId/extractions', getThreadExtractions);

// Route for getting a thread's messages
// GET /api/chat/threads/:threadId/messages
router.get('/threads/:threadId/messages', getThreadMessages);

export default router;