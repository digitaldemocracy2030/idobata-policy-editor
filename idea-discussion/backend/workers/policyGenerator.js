import mongoose from "mongoose";
import PolicyDraft from "../models/PolicyDraft.js";
import Problem from "../models/Problem.js";
import QuestionLink from "../models/QuestionLink.js";
import SharpQuestion from "../models/SharpQuestion.js";
import Solution from "../models/Solution.js";
import { callLLM } from "../services/llmService.js";

async function generatePolicyDraft(questionId) {
  console.log(
    `[PolicyGenerator] Starting policy draft generation for questionId: ${questionId}`
  );
  try {
    // 1. Fetch the SharpQuestion
    const question = await SharpQuestion.findById(questionId);
    if (!question) {
      console.error(
        `[PolicyGenerator] SharpQuestion not found for id: ${questionId}`
      );
      return;
    }
    console.log(`[PolicyGenerator] Found question: "${question.questionText}"`);

    // 2. Fetch related Problem and Solution statements via QuestionLink with relevanceScore
    const links = await QuestionLink.find({ questionId: questionId });

    // Separate problem and solution links
    const problemLinks = links.filter(
      (link) => link.linkedItemType === "problem"
    );
    const solutionLinks = links.filter(
      (link) => link.linkedItemType === "solution"
    );

    // Sort links by relevanceScore (highest first)
    problemLinks.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
    solutionLinks.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );

    // Extract IDs from sorted links
    const problemIds = problemLinks.map((link) => link.linkedItemId);
    const solutionIds = solutionLinks.map((link) => link.linkedItemId);

    // Create a map of IDs to relevanceScores for later use
    const relevanceScoreMap = new Map();
    for (const link of links) {
      relevanceScoreMap.set(
        link.linkedItemId.toString(),
        link.relevanceScore || 0
      );
    }

    // Fetch problems and solutions
    const problems = await Problem.find({ _id: { $in: problemIds } });
    const solutions = await Solution.find({ _id: { $in: solutionIds } });

    // Sort problems and solutions according to the order of IDs (which are already sorted by relevanceScore)
    const sortedProblems = problemIds
      .map((id) => problems.find((p) => p._id.toString() === id.toString()))
      .filter(Boolean); // Remove any undefined values

    const sortedSolutions = solutionIds
      .map((id) => solutions.find((s) => s._id.toString() === id.toString()))
      .filter(Boolean); // Remove any undefined values

    // Map to statements with relevance scores
    const problemStatements = sortedProblems.map((p) => p.statement);
    const solutionStatements = sortedSolutions.map((s) => s.statement);

    console.log(
      `[PolicyGenerator] Found ${problemStatements.length} related problems and ${solutionStatements.length} related solutions, sorted by relevance.`
    );

    // 3. Prepare the prompt for LLM
    const messages = [
      {
        role: "system",
        content: `あなたはAIアシスタントです。中心的な問い（「私たちはどのようにして...できるか？」）、関連する問題点のリスト、そして市民からの意見を通じて特定された潜在的な解決策のリストに基づいて、政策文書を作成する任務を負っています。
あなたの出力は、'content'フィールド内に明確に2つのパートで構成されなければなりません。

Part 1: ビジョンレポート
- 提供された問題点と解決策の意見を分析し、統合してください。
- **現状認識**と**理想像**について、それぞれ**合意点**と**相違点**（トレードオフを含む）を整理してください。
- このパートでは、**どのように解決するか（How）の話は含めず**、課題認識と理想像の明確化に焦点を当ててください。
- 類似したアイデアやテーマをグループ化してください。
- 考慮された問題点と解決策の意見の数を明確に述べてください。
- できる限り具体性が高く、生の声（引用など）を取り入れてください。
- 特定された合意点と相違点を反映し、市民から提起された主要な懸念事項と提案された理想像を要約してください。
- このセクションは、現状と目指すべき理想像に関する市民の多様な視点（合意点、相違点、トレードオフ）を理解しようとする政策立案者にとって、情報価値の高いレポートとなるべきです。箇条書きではなく、しっかりとした文章で記述してください。
- 目標文字数：約7000文字

Part 2: 解決手段レポート
- Part 1で整理された**合意できている理想像**に向けて、提供された解決策の意見を分析・整理してください。
- 理想像を実現するための具体的な解決策を提案してください。
- 類似したアイデアやテーマをグループ化してください。
- 考慮された解決策の意見の数を明確に述べてください。
- 提案が市民のフィードバックに基づいていることを示すために、市民の意見からの特定のテーマや提案の数を参照してください（例：「Yに関するM個の提案に基づいて...」）。
- 現実的で具体的な初期草案を作成することに焦点を当ててください。異なる選択肢間のトレードオフも考慮に入れてください。
- 箇条書きではなく、しっかりとした文章で記述してください。
- 目標文字数：約7000文字

応答は、"title"（文字列、文書全体に適したタイトル）と "content"（文字列、'ビジョンレポート'と'解決手段レポート'の両セクションを含み、Markdownヘッダー（例：## ビジョンレポート、## 解決手段レポート）などを使用して明確に区切られ、フォーマットされたもの）のキーを含むJSONオブジェクトのみで行ってください。JSON構造外に他のテキストや説明を含めないでください。`,
      },
      {
        role: "user",
        content: `Generate a report for the following question:
Question: ${question.questionText}

Related Problems (sorted by relevance - higher items are more relevant to the question):
${problemStatements.length > 0 ? problemStatements.map((p) => `- ${p}`).join("\n") : "- None provided"}

Related Solutions (sorted by relevance - higher items are more relevant to the question):
${solutionStatements.length > 0 ? solutionStatements.map((s) => `- ${s}`).join("\n") : "- None provided"}

Please provide the output as a JSON object with "title" and "content" keys. When considering the problems and solutions, prioritize those listed at the top as they are more relevant to the question.`,
      },
    ];

    // 4. Call LLM
    console.log("[PolicyGenerator] Calling LLM to generate policy draft...");
    const llmResponse = await callLLM(
      messages,
      true,
      "google/gemini-2.5-pro-preview-03-25"
    ); // Request JSON output with specific model

    if (
      !llmResponse ||
      typeof llmResponse !== "object" ||
      !llmResponse.title ||
      !llmResponse.content
    ) {
      console.error(
        "[PolicyGenerator] Failed to get valid JSON response from LLM:",
        llmResponse
      );
      throw new Error(
        "Invalid response format from LLM for policy draft generation."
      );
    }

    console.log(
      `[PolicyGenerator] LLM generated draft titled: "${llmResponse.title}"`
    );

    // 5. Save the Policy Draft
    const newDraft = new PolicyDraft({
      questionId: questionId,
      title: llmResponse.title,
      content: llmResponse.content,
      sourceProblemIds: problemIds,
      sourceSolutionIds: solutionIds,
      version: 1,
    });

    await newDraft.save();
    console.log(
      `[PolicyGenerator] Successfully saved policy draft with ID: ${newDraft._id}`
    );
  } catch (error) {
    console.error(
      `[PolicyGenerator] Error generating policy draft for questionId ${questionId}:`,
      error
    );
    // Add more robust error handling/reporting if needed
  }
}

export { generatePolicyDraft };
