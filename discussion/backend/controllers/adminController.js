import { generateSharpQuestions } from '../workers/questionGenerator.js';
import Problem from '../models/Problem.js';
import Solution from '../models/Solution.js';

// Controller to trigger the sharp question generation process
const triggerQuestionGeneration = async (req, res) => {
    console.log('[AdminController] Received request to generate sharp questions.');
    try {
        // Call the generation function (non-blocking, but we'll wait for it here for simplicity in manual trigger)
        // In a production scenario, this might add a job to a queue instead of direct execution.
        await generateSharpQuestions();

        res.status(202).json({ message: 'Sharp question generation process started successfully.' });
    } catch (error) {
        console.error('[AdminController] Error triggering question generation:', error);
        res.status(500).json({ message: 'Failed to start sharp question generation process.' });
    }
};

// Controller to get all problems
const getAllProblems = async (req, res) => {
    console.log('[AdminController] Fetching all problems');
    try {
        const problems = await Problem.find().sort({ createdAt: -1 });
        res.status(200).json(problems);
    } catch (error) {
        console.error('[AdminController] Error fetching problems:', error);
        res.status(500).json({ message: 'Failed to fetch problems' });
    }
};

// Controller to get all solutions
const getAllSolutions = async (req, res) => {
    console.log('[AdminController] Fetching all solutions');
    try {
        const solutions = await Solution.find().sort({ createdAt: -1 });
        res.status(200).json(solutions);
    } catch (error) {
        console.error('[AdminController] Error fetching solutions:', error);
        res.status(500).json({ message: 'Failed to fetch solutions' });
    }
};

export { triggerQuestionGeneration, getAllProblems, getAllSolutions };