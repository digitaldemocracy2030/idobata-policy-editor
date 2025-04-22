import Problem from '../models/Problem.js';
import SharpQuestion from '../models/SharpQuestion.js';
import { callLLM } from '../services/llmService.js';
import { linkQuestionToAllItems } from './linkingWorker.js'; // Import the linking function

async function generateSharpQuestions() {
    console.log('[QuestionGenerator] Starting sharp question generation...');
    try {
        // 1. Fetch all problem statements
        const problems = await Problem.find({}, 'statement').lean();
        if (!problems || problems.length === 0) {
            console.log('[QuestionGenerator] No problems found to generate questions from.');
            return;
        }
        const problemStatements = problems.map(p => p.statement);
        console.log(`[QuestionGenerator] Found ${problemStatements.length} problem statements.`);

        // 2. Prepare prompt for LLM
        const messages = [
            {
                role: 'system',
                content: `You are an AI assistant specialized in synthesizing problem statements into insightful "How Might We..." (HMW) questions based on Design Thinking principles. Your goal is to generate concise, actionable, and thought-provoking questions that capture the essence of the underlying challenges presented in the input problem statements. Consolidate similar problems into broader HMW questions where appropriate.

IMPORTANT: When generating questions, focus exclusively on describing both the current state ("現状はこう") and the desired state ("それをこうしたい") with high detail. Do NOT suggest or imply any specific means, methods, or solutions in the questions. The questions should keep the problem space open for creative solutions rather than narrowing the range of possible answers.

Generate all questions in Japanese language, using the format "どのようにできるだろうか？" instead of "How Might We...". Respond ONLY with a JSON object containing a single key "questions" which holds an array of strings, where each string is a generated question in Japanese.

Generate 5-10 questions.
`
            },
            {
                role: 'user',
                content: `Based on the following problem statements, please generate relevant questions in Japanese using the format "How Might We...":\n\n${problemStatements.join('\n- ')}\n\nFor each question, clearly describe both the current state ("現状はこう") and the desired state ("それをこうしたい") with high detail. Focus exclusively on describing these states without suggesting any specific means, methods, or solutions that could narrow the range of possible answers.\n\nPlease provide the output as a JSON object with a "questions" array containing Japanese questions only.`
            }
        ];

        // 3. Call LLM
        console.log('[QuestionGenerator] Calling LLM to generate questions...');
        const llmResponse = await callLLM(messages, true, 'google/gemini-2.5-pro-preview-03-25'); // Request JSON output with specific model

        if (!llmResponse || !Array.isArray(llmResponse.questions) || llmResponse.questions.length === 0) {
            console.error('[QuestionGenerator] Failed to get valid questions from LLM response:', llmResponse);
            return;
        }

        const generatedQuestions = llmResponse.questions;
        console.log(`[QuestionGenerator] LLM generated ${generatedQuestions.length} questions.`);

        // 4. Save questions to DB (avoid duplicates)
        let savedCount = 0;
        for (const questionText of generatedQuestions) {
            if (!questionText || typeof questionText !== 'string') {
                console.warn('[QuestionGenerator] Skipping invalid question text:', questionText);
                continue;
            }
            try {
                // Use findOneAndUpdate with upsert to avoid duplicates based on questionText
                const result = await SharpQuestion.findOneAndUpdate(
                    { questionText: questionText.trim() },
                    { $setOnInsert: { questionText: questionText.trim(), createdAt: new Date() } }, // Add createdAt on insert
                    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true } // Create if not exists, return the new doc
                );

                // Check if it was an upsert (a new document was created)
                // The result object will contain the _id. If upserted:true is in the result, it's new.
                // A simpler check might be to compare createdAt with a time just before the loop,
                // but checking the result object structure or comparing timestamps is more robust.
                // For simplicity, let's assume if we get a result, we trigger linking.
                // A more precise check would involve comparing timestamps or checking the upserted flag if available in the result.
                if (result && result._id) {
                    // Trigger linking asynchronously for the new or existing question
                    // Linking all items to this question might be resource-intensive.
                    // Consider triggering only if it's a truly *new* question.
                    // For now, trigger it regardless, as per the simplified approach.
                    console.log(`[QuestionGenerator] Triggering linking for question ID: ${result._id}`);
                    setTimeout(() => linkQuestionToAllItems(result._id.toString()), 0);
                    savedCount++; // Count successfully processed questions
                } else {
                    console.warn(`[QuestionGenerator] Failed to save or find question: ${questionText}`);
                }
            } catch (dbError) {
                console.error(`[QuestionGenerator] Error saving question "${questionText}":`, dbError);
            }
        }

        console.log(`[QuestionGenerator] Successfully processed ${savedCount} questions (new or existing).`);
        // Linking is now triggered after each question is saved/upserted above.

    } catch (error) {
        console.error('[QuestionGenerator] Error during sharp question generation:', error);
    }
}

export { generateSharpQuestions };