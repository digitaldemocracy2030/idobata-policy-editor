import express from 'express';
import { getPolicyDrafts } from '../controllers/policyController.js';
// Import the policy generation trigger controller function if it's separate
// For now, assuming the trigger is still in questionController as per Step 15

const router = express.Router();

// Route to get policy drafts (potentially filtered by questionId)
router.get('/', getPolicyDrafts);

// Note: The POST route to *trigger* generation is likely still under /api/questions/:questionId/generate-policy
// as defined in Step 15 and handled by questionController.js

export default router;