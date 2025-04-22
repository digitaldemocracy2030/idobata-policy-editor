import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import Solution from '../models/Solution.js';
import SharpQuestion from '../models/SharpQuestion.js';
import QuestionLink from '../models/QuestionLink.js';
import { callLLM } from '../services/llmService.js';

/**
 * Links a specific Problem or Solution item to relevant SharpQuestions using LLM.
 * @param {string} itemId - The ID of the Problem or Solution item.
 * @param {'problem' | 'solution'} itemType - The type of the item ('problem' or 'solution').
 */
async function linkItemToQuestions(itemId, itemType) {
    console.log(`[LinkingWorker] Starting linking for ${itemType} ID: ${itemId}`);
    try {
        let item;
        if (itemType === 'problem') {
            item = await Problem.findById(itemId);
        } else if (itemType === 'solution') {
            item = await Solution.findById(itemId);
        } else {
            console.error(`[LinkingWorker] Invalid itemType: ${itemType}`);
            return;
        }

        if (!item) {
            console.error(`[LinkingWorker] ${itemType} not found with ID: ${itemId}`);
            return;
        }

        const itemStatement = itemType === 'problem' ? item.statement : item.statement;
        if (!itemStatement) {
            console.warn(`[LinkingWorker] Statement is empty for ${itemType} ID: ${itemId}. Skipping linking.`);
            return;
        }

        const questions = await SharpQuestion.find({});
        if (questions.length === 0) {
            console.log('[LinkingWorker] No sharp questions found to link against.');
            return;
        }

        console.log(`[LinkingWorker] Found ${questions.length} questions. Checking links for ${itemType} ID: ${itemId}`);

        for (const question of questions) {
            const promptMessages = [
                {
                    role: 'system',
                    content: `You are an AI assistant that determines the relationship between a "Sharp Question" (often in "How might we..." format) and a "Statement" (which can be a Problem or a Solution).
Your task is to analyze the provided Question and Statement and determine if the Statement either:
1.  **Prompts the Question (link_type: "prompts_question"):** The Problem statement directly leads to or exemplifies the core issue addressed by the Question.
2.  **Answers the Question (link_type: "answers_question"):** The Solution statement offers a potential way to address the challenge posed by the Question.

Respond ONLY in JSON format with the following structure:
{
  "is_relevant": boolean, // true if the statement prompts or answers the question, false otherwise
  "link_type": "prompts_question" | "answers_question" | null, // The type of link, or null if not relevant
  "rationale": string, // A brief explanation for your decision (max 1-2 sentences)
  "relevanceScore": number // A score between 0.0 and 1.0 indicating relevance. 1 if it has clear, direct and strong relevance. 0.5 if it has some relevance. 0.0 if not relevant.
}`
                },
                {
                    role: 'user',
                    content: `Sharp Question: "${question.questionText}"

Statement (${itemType}): "${itemStatement}"

Analyze the relationship and provide the JSON output.`
                }
            ];

            try {
                const llmResponse = await callLLM(promptMessages, true); // Request JSON output

                if (llmResponse && llmResponse.is_relevant) {
                    console.log(`[LinkingWorker] Found relevant link: Question ${question._id} <-> ${itemType} ${itemId} (Type: ${llmResponse.link_type})`);
                    await QuestionLink.findOneAndUpdate(
                        { questionId: question._id, linkedItemId: item._id },
                        {
                            questionId: question._id,
                            linkedItemId: item._id,
                            linkedItemType: itemType,
                            linkType: llmResponse.link_type,
                            relevanceScore: llmResponse.relevanceScore || 0.8, // Default score if missing
                            rationale: llmResponse.rationale || 'N/A',
                        },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                } else {
                    // Optional: Log if not relevant or if response format is wrong
                    // console.log(`[LinkingWorker] No relevant link found or invalid response for Question ${question._id} and ${itemType} ${itemId}`);
                }
            } catch (llmError) {
                console.error(`[LinkingWorker] LLM call failed for Question ${question._id} and ${itemType} ${itemId}:`, llmError);
                // Continue to the next question even if one LLM call fails
            }
        }

        console.log(`[LinkingWorker] Finished linking for ${itemType} ID: ${itemId}`);

    } catch (error) {
        console.error(`[LinkingWorker] Error processing linking for ${itemType} ID ${itemId}:`, error);
    }
}

/**
 * Links all existing Problems and Solutions to a specific SharpQuestion.
 * Typically called after a new question is generated.
 * @param {string} questionId - The ID of the newly generated SharpQuestion.
 */
async function linkQuestionToAllItems(questionId) {
    console.log(`[LinkingWorker] Starting linking for new Question ID: ${questionId}`);
    try {
        const question = await SharpQuestion.findById(questionId);
        if (!question) {
            console.error(`[LinkingWorker] SharpQuestion not found with ID: ${questionId}`);
            return;
        }

        const problems = await Problem.find({});
        const solutions = await Solution.find({});

        console.log(`[LinkingWorker] Linking Question ${questionId} to ${problems.length} problems and ${solutions.length} solutions.`);

        // Link Problems
        for (const problem of problems) {
            // Avoid redundant calls, call the existing function
            await linkItemToQuestions(problem._id.toString(), 'problem');
        }

        // Link Solutions
        for (const solution of solutions) {
            // Avoid redundant calls, call the existing function
            await linkItemToQuestions(solution._id.toString(), 'solution');
        }

        console.log(`[LinkingWorker] Finished linking for new Question ID: ${questionId}`);

    } catch (error) {
        console.error(`[LinkingWorker] Error processing linking for Question ID ${questionId}:`, error);
    }
}


export { linkItemToQuestions, linkQuestionToAllItems };