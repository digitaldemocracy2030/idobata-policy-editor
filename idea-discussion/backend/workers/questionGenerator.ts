import { Types } from "mongoose";
import Problem from "../models/Problem.js";
import SharpQuestion from "../models/SharpQuestion.js";
import { ISharpQuestion } from "../types/index.js";
import { ChatMessage, callLLM } from "../services/llmService.js";
import { linkQuestionToAllItems } from "./linkingWorker.js"; // Import the linking function

interface LLMResponse {
  questions: string[];
  [key: string]: unknown;
}

async function generateSharpQuestions(themeId: string | Types.ObjectId): Promise<void> {
  console.log(
    `[QuestionGenerator] Starting sharp question generation for theme ${themeId}...`
  );
  try {
    const problems = await Problem.find({ themeId }, "content").lean();
    if (!problems || problems.length === 0) {
      console.log(
        `[QuestionGenerator] No problems found for theme ${themeId} to generate questions from.`
      );
      return;
    }
    const problemStatements = problems.map((p) => p.content);
    console.log(
      `[QuestionGenerator] Found ${problemStatements.length} problem statements for theme ${themeId}.`
    );

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are an AI assistant specialized in synthesizing problem statements into insightful "How Might We..." (HMW) questions based on Design Thinking principles. Your goal is to generate concise, actionable, and thought-provoking questions that capture the essence of the underlying challenges presented in the input problem statements. Consolidate similar problems into broader HMW questions where appropriate.

IMPORTANT: When generating questions, focus exclusively on describing both the current state ("現状はこう") and the desired state ("それをこうしたい") with high detail. Do NOT suggest or imply any specific means, methods, or solutions in the questions. The questions should keep the problem space open for creative solutions rather than narrowing the range of possible answers.

Generate all questions in Japanese language, using the format "〜にはどうすればいいだろうか？" instead of "How Might We...". Respond ONLY with a JSON object containing a single key "questions" which holds an array of strings, where each string is a generated question in Japanese.

Generate 5 questions. 50-100字以内程度。
`,
      },
      {
        role: "user",
        content: `Based on the following problem statements, please generate relevant questions in Japanese using the format "How Might We...":\n\n${problemStatements.join("\n- ")}\n\nFor each question, clearly describe both the current state ("現状はこう") and the desired state ("それをこうしたい") with high detail. Focus exclusively on describing these states without suggesting any specific means, methods, or solutions that could narrow the range of possible answers.\n\nPlease provide the output as a JSON object with a "questions" array containing Japanese questions only.`,
      },
    ];

    console.log("[QuestionGenerator] Calling LLM to generate questions...");
    const llmResponse = await callLLM(
      messages,
      true,
      "google/gemini-2.5-pro-preview-03-25"
    ) as LLMResponse; // Request JSON output with specific model

    if (
      !llmResponse ||
      !Array.isArray(llmResponse.questions) ||
      llmResponse.questions.length === 0
    ) {
      console.error(
        "[QuestionGenerator] Failed to get valid questions from LLM response:",
        llmResponse
      );
      return;
    }

    const generatedQuestions = llmResponse.questions;
    console.log(
      `[QuestionGenerator] LLM generated ${generatedQuestions.length} questions.`
    );

    let savedCount = 0;
    for (const questionText of generatedQuestions) {
      if (!questionText || typeof questionText !== "string") {
        console.warn(
          "[QuestionGenerator] Skipping invalid question text:",
          questionText
        );
        continue;
      }
      try {
        const result = await SharpQuestion.findOneAndUpdate(
          { content: questionText.trim(), themeId }, // Include themeId in query
          {
            $setOnInsert: {
              content: questionText.trim(),
              themeId,
              createdAt: new Date(),
            },
          }, // Add themeId and createdAt on insert
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            runValidators: true,
          } // Create if not exists, return the new doc
        ) as ISharpQuestion | null;

        if (result?._id) {
          console.log(
            `[QuestionGenerator] Triggering linking for question ID: ${result._id}`
          );
          setTimeout(() => linkQuestionToAllItems(result._id.toString()), 0);
          savedCount++; // Count successfully processed questions
        } else {
          console.warn(
            `[QuestionGenerator] Failed to save or find question: ${questionText}`
          );
        }
      } catch (dbError) {
        console.error(
          `[QuestionGenerator] Error saving question "${questionText}":`,
          dbError
        );
      }
    }

    console.log(
      `[QuestionGenerator] Successfully processed ${savedCount} questions (new or existing).`
    );
  } catch (error) {
    console.error(
      "[QuestionGenerator] Error during sharp question generation:",
      error
    );
  }
}

export { generateSharpQuestions };
