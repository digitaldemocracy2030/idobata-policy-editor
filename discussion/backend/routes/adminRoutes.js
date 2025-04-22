import express from 'express';
import { triggerQuestionGeneration, getAllProblems, getAllSolutions } from '../controllers/adminController.js';

const router = express.Router();

// POST /api/admin/generate-questions
router.post('/generate-questions', triggerQuestionGeneration);

// GET /api/admin/problems
router.get('/problems', getAllProblems);

// GET /api/admin/solutions
router.get('/solutions', getAllSolutions);

export default router;