import mongoose from "mongoose"; // Import mongoose for ObjectId validation
import { v4 as uuidv4 } from "uuid"; // For generating temporary user IDs
import ChatThread from "../models/ChatThread.js";
import QuestionLink from "../models/QuestionLink.js"; // Import QuestionLink model
import SharpQuestion from "../models/SharpQuestion.js"; // Import SharpQuestion model
import { callLLM } from "../services/llmService.js"; // Import the LLM service
import { processExtraction } from "../workers/extractionWorker.js"; // Import the extraction worker function

// Controller function for handling new chat messages by theme
const handleNewMessageByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID format" });
  }

  try {
    let { userId, message, threadId } = req.body;

    // Validate input
    if (!message) {
      return res.status(400).json({ error: "Message content is required." });
    }

    // Generate a temporary userId if not provided
    if (!userId) {
      userId = `temp_${uuidv4()}`;
      console.log(`Generated temporary userId: ${userId}`);
    }

    let chatThread;

    if (threadId) {
      // If threadId is provided, find the existing thread
      console.log(`Looking for existing chat thread with ID: ${threadId}`);
      chatThread = await ChatThread.findById(threadId);
      if (!chatThread) {
        console.error(`Chat thread with ID ${threadId} not found.`);
        return res.status(404).json({ error: "Chat thread not found." });
      }

      if (!chatThread.themeId || chatThread.themeId.toString() !== themeId) {
        console.error(`Thread ${threadId} does not belong to theme ${themeId}`);
        return res
          .status(403)
          .json({ error: "Thread does not belong to the specified theme." });
      }

      // Optional: Verify if the userId matches the thread's userId if needed for security
      if (chatThread.userId !== userId) {
        console.warn(
          `User ID mismatch for thread ${threadId}. Request userId: ${userId}, Thread userId: ${chatThread.userId}`
        );
      }
      console.log(`Found existing chat thread with ID: ${threadId}`);
    } else {
      // If no threadId is provided, create a new thread
      console.log(
        `Creating new chat thread for userId: ${userId} in theme: ${themeId}`
      );
      chatThread = new ChatThread({
        userId: userId,
        messages: [],
        extractedProblemIds: [],
        extractedSolutionIds: [],
        themeId: themeId, // Add themeId to the new thread
      });
    }

    // Add user message to the thread
    chatThread.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // --- Fetch Reference Opinions (Sharp Questions and related Problems/Solutions) ---
    let referenceOpinions = "";
    try {
      const themeQuestions = await SharpQuestion.find({ themeId }).lean();

      if (themeQuestions.length > 0) {
        referenceOpinions +=
          "参考情報として、システム内で議論されている主要な「問い」と、それに関連する意見の一部を紹介します:\n\n";

        for (const question of themeQuestions) {
          referenceOpinions += `問い: ${question.questionText}\n`;

          // Find up to 10 random related problems with relevance > 0.8
          const problemLinks = await QuestionLink.aggregate([
            {
              $match: {
                questionId: question._id,
                linkedItemType: "problem",
                linkType: "prompts_question",
                relevanceScore: { $gte: 0.8 },
              },
            },
            { $sample: { size: 10 } },
            {
              $lookup: {
                from: "problems",
                localField: "linkedItemId",
                foreignField: "_id",
                as: "linkedProblem",
              },
            },
            {
              $unwind: {
                path: "$linkedProblem",
                preserveNullAndEmptyArrays: true,
              },
            },
          ]);

          if (
            problemLinks.length > 0 &&
            problemLinks.some((link) => link.linkedProblem)
          ) {
            referenceOpinions += "  関連性の高い課題:\n";
            for (const link of problemLinks) {
              if (link.linkedProblem) {
                const problem = link.linkedProblem;
                if (problem.themeId && problem.themeId.toString() === themeId) {
                  const statement =
                    problem.statement ||
                    problem.combinedStatement ||
                    problem.statementA ||
                    problem.statementB ||
                    "N/A";
                  referenceOpinions += `    - ${statement})\n`;
                }
              }
            }
          } else {
            referenceOpinions += "  関連性の高い課題: (ありません)\n";
          }

          // Find up to 10 random related solutions with relevance > 0.8
          const solutionLinks = await QuestionLink.aggregate([
            {
              $match: {
                questionId: question._id,
                linkedItemType: "solution",
                linkType: "answers_question",
                relevanceScore: { $gte: 0.8 },
              },
            },
            { $sample: { size: 10 } },
            {
              $lookup: {
                from: "solutions",
                localField: "linkedItemId",
                foreignField: "_id",
                as: "linkedSolution",
              },
            },
            {
              $unwind: {
                path: "$linkedSolution",
                preserveNullAndEmptyArrays: true,
              },
            },
          ]);

          if (
            solutionLinks.length > 0 &&
            solutionLinks.some((link) => link.linkedSolution)
          ) {
            referenceOpinions +=
              "  関連性の高い解決策 (最大10件, 関連度 >80%):\n";
            for (const link of solutionLinks) {
              if (link.linkedSolution) {
                const solution = link.linkedSolution;
                if (
                  solution.themeId &&
                  solution.themeId.toString() === themeId
                ) {
                  referenceOpinions += `    - ${solution.statement || "N/A"})\n`;
                }
              }
            }
          } else {
            referenceOpinions += "  関連性の高い解決策: (ありません)\n";
          }
          referenceOpinions += "\n"; // Add space between questions
        }
        referenceOpinions +=
          "---\nこれらの「問い」や関連意見も踏まえ、ユーザーとの対話を深めてください。\n";
      }
    } catch (dbError) {
      console.error(
        `Error fetching reference opinions for theme ${themeId}:`,
        dbError
      );
      // Continue without reference opinions if DB fetch fails
    }
    // --- End Fetch Reference Opinions ---

    // --- Call LLM for AI Response ---
    // Prepare messages for the LLM (ensure correct format)
    const llmMessages = [];

    // --- Define the core system prompt ---
    const systemPrompt = `あなたは、ユーザーが抱える課題やその解決策についての考えを深めるための、対話型アシスタントです。以下の点を意識して応答してください。

1.  **思考の深掘り:** ユーザーの発言から、具体的な課題や解決策のアイデアを引き出すことを目指します。曖昧な点や背景が不明な場合は、「いつ」「どこで」「誰が」「何を」「なぜ」「どのように」といった質問（5W1H）を自然な会話の中で投げかけ、具体的な情報を引き出してください。
2.  **簡潔な応答:** あなたの応答は、最大でも4文以内にまとめてください。
3.  **課題/解決策の抽出支援:** ユーザーが自身の考えを整理し、明確な「課題」や「解決策」として表現できるよう、対話を通じてサポートしてください。
課題の表現は、主語を明確にし、具体的な状況と影響を記述することで、問題の本質を捉えやすくする必要があります。現状と理想の状態を明確に記述し、そのギャップを課題として定義する。解決策の先走りや抽象的な表現を避け、「誰が」「何を」「なぜ」という構造で課題を定義することで、問題の範囲を明確にし、多様な視点からの議論を促します。感情的な表現や主観的な解釈を排し、客観的な事実に基づいて課題を記述することが重要です。
解決策の表現は、具体的な行動や機能、そしてそれがもたらす価値を明確に記述する必要があります。実現可能性や費用対効果といった制約条件も考慮し、曖昧な表現や抽象的な概念を避けることが重要です。解決策は、課題に対する具体的な応答として提示され、その効果やリスク、そして実装に必要なステップを明確にすべき。
4.  **心理的安全性の確保:** ユーザーのペースを尊重し、急かさないこと。論理的な詰め寄りや過度な質問攻めを避けること。ユーザーが答えられない質問には固執せず、別の角度からアプローチすること。完璧な回答を求めず、ユーザーの部分的な意見も尊重すること。対話は協力的な探索であり、試験や審査ではないことを意識すること。
5.  **話題の誘導:** ユーザーの発言が曖昧で、特に話したいトピックが明確でない場合、参考情報として提示された既存の問いのどれかをピックアップしてそれについて議論することを優しく提案してください。（問いを一字一句読み上げるのではなく、文脈や相手に合わせて言い換えて分かりやすく伝える）
`;
    llmMessages.push({ role: "system", content: systemPrompt });
    // --- End core system prompt ---

    // Add the reference opinions as a system message
    if (referenceOpinions) {
      llmMessages.push({ role: "system", content: referenceOpinions });
    }

    // Add actual chat history
    llmMessages.push(
      ...chatThread.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
    );

    // Call the LLM service
    const aiResponseContent = await callLLM(llmMessages);

    if (!aiResponseContent) {
      console.error("LLM did not return a response.");
      return res
        .status(500)
        .json({ error: "AI failed to generate a response." });
    }

    // Add AI response to the thread
    chatThread.messages.push({
      role: "assistant",
      content: aiResponseContent,
      timestamp: new Date(),
    });
    // --- End LLM Call ---

    // Save the updated thread
    await chatThread.save();
    console.log(`Saved chat thread for userId: ${userId} in theme: ${themeId}`);

    // --- Trigger asynchronous extraction ---
    setTimeout(() => {
      const job = {
        data: {
          sourceType: "chat",
          sourceOriginId: chatThread._id.toString(),
          content: null,
          metadata: {},
          themeId: themeId, // Include themeId in job data
        },
        app: req.app // Pass the app context to access the notification service
      };

      processExtraction(job).catch((err) => {
        console.error(
          `[Async Extraction Call] Error for thread ${chatThread._id} in theme ${themeId}:`,
          err
        );
      });
    }, 0);
    // --- End Trigger ---

    // Return the response
    const responsePayload = {
      response: aiResponseContent,
      threadId: chatThread._id,
    };
    if (req.body.userId !== userId) {
      responsePayload.userId = userId;
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error(`Error handling new message for theme ${themeId}:`, error);
    res
      .status(500)
      .json({ error: "Internal server error while processing message." });
  }
};

// Controller function for getting extractions for a specific thread by theme
const getThreadExtractionsByTheme = async (req, res) => {
  const { themeId, threadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID format" });
  }

  if (!threadId) {
    return res.status(400).json({ error: "Thread ID is required." });
  }

  try {
    // Find the chat thread and populate the extracted problems and solutions
    const chatThread = await ChatThread.findById(threadId)
      .populate("extractedProblemIds")
      .populate("extractedSolutionIds");

    if (!chatThread) {
      return res.status(404).json({ error: "Chat thread not found." });
    }

    if (!chatThread.themeId || chatThread.themeId.toString() !== themeId) {
      console.error(`Thread ${threadId} does not belong to theme ${themeId}`);
      return res
        .status(403)
        .json({ error: "Thread does not belong to the specified theme." });
    }

    // Return the populated problems and solutions
    res.status(200).json({
      problems: chatThread.extractedProblemIds || [],
      solutions: chatThread.extractedSolutionIds || [],
    });
  } catch (error) {
    console.error(
      `Error getting thread extractions for theme ${themeId}:`,
      error
    );
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid Thread ID format." });
    }
    res
      .status(500)
      .json({ error: "Internal server error while getting extractions." });
  }
};

// Controller function for getting a thread's messages by theme
const getThreadMessagesByTheme = async (req, res) => {
  const { themeId, threadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID format" });
  }

  if (!threadId) {
    return res.status(400).json({ error: "Thread ID is required." });
  }

  try {
    // Find the chat thread
    const chatThread = await ChatThread.findById(threadId);

    if (!chatThread) {
      return res.status(404).json({ error: "Chat thread not found." });
    }

    if (!chatThread.themeId || chatThread.themeId.toString() !== themeId) {
      console.error(`Thread ${threadId} does not belong to theme ${themeId}`);
      return res
        .status(403)
        .json({ error: "Thread does not belong to the specified theme." });
    }

    // Return the thread's messages
    res.status(200).json({
      threadId: chatThread._id,
      userId: chatThread.userId,
      themeId: chatThread.themeId,
      messages: chatThread.messages || [],
    });
  } catch (error) {
    console.error(`Error getting thread messages for theme ${themeId}:`, error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid Thread ID format." });
    }
    res
      .status(500)
      .json({ error: "Internal server error while getting thread messages." });
  }
};

export {
  getThreadExtractionsByTheme,
  getThreadMessagesByTheme,
  handleNewMessageByTheme,
};
