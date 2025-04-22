import express from 'express';
import { importGenericData } from '../controllers/importController.js'; // Also add .js extension
// Add authentication middleware if needed
// const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Route for importing generic data like tweets
// Apply authentication middleware if this endpoint should be protected
// router.post('/generic', protect, importGenericData);
router.post('/generic', importGenericData);

export default router;