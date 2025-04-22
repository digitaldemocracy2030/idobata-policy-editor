import PolicyDraft from '../models/PolicyDraft.js';

// Controller to get policy drafts
export const getPolicyDrafts = async (req, res) => {
    try {
        const { questionId } = req.query; // Optional query parameter for filtering

        const query = {};
        if (questionId) {
            query.questionId = questionId;
        }

        const drafts = await PolicyDraft.find(query)
            .sort({ createdAt: -1 }) // Sort by creation date, newest first
            .populate('questionId', 'questionText'); // Optionally populate question text

        res.status(200).json(drafts);
    } catch (error) {
        console.error('Error fetching policy drafts:', error);
        res.status(500).json({ message: 'Failed to fetch policy drafts', error: error.message });
    }
};