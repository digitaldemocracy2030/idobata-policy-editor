import { Types } from "mongoose";
import DigestDraft from "../models/DigestDraft.js";
import PolicyDraft from "../models/PolicyDraft.js";
import Problem from "../models/Problem.js";
import QuestionLink from "../models/QuestionLink.js";
import SharpQuestion from "../models/SharpQuestion.js";
import Solution from "../models/Solution.js";
import { ChatMessage, callLLM } from "../services/llmService.js";

interface DigestResponse {
  title: string;
  content: string;
  [key: string]: unknown;
}

async function generateDigestDraft(questionId: string): Promise<void> {
  console.log(
    `[DigestGenerator] Starting digest draft generation for questionId: ${questionId}`
  );
  try {
    const question = await SharpQuestion.findById(questionId);
    if (!question) {
      console.error(
        `[DigestGenerator] SharpQuestion not found for id: ${questionId}`
      );
      return;
    }
    console.log(`[DigestGenerator] Found question: "${question.content}"`);

    const links = await QuestionLink.find({ questionId: questionId });

    const problemLinks = links.filter(
      (link) => link.linkedItemType === "problem"
    );
    const solutionLinks = links.filter(
      (link) => link.linkedItemType === "solution"
    );

    problemLinks.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
    solutionLinks.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );

    const problemIds = problemLinks.map((link) => link.linkedItemId);
    const solutionIds = solutionLinks.map((link) => link.linkedItemId);

    const relevanceScoreMap = new Map<string, number>();
    for (const link of links) {
      relevanceScoreMap.set(
        link.linkedItemId.toString(),
        link.relevanceScore || 0
      );
    }

    const problems = await Problem.find({ _id: { $in: problemIds } });
    const solutions = await Solution.find({ _id: { $in: solutionIds } });

    const sortedProblems = problemIds
      .map((id) => problems.find((p) => p._id.toString() === id.toString()))
      .filter(Boolean); // Remove any undefined values

    const sortedSolutions = solutionIds
      .map((id) => solutions.find((s) => s._id.toString() === id.toString()))
      .filter(Boolean); // Remove any undefined values

    const problemStatements = sortedProblems.map((p) => p.content);
    const solutionStatements = sortedSolutions.map((s) => s.content);

    console.log(
      `[DigestGenerator] Found ${problemStatements.length} related problems and ${solutionStatements.length} related solutions, sorted by relevance.`
    );

    const latestPolicyDraft = await PolicyDraft.findOne({
      questionId: questionId,
    })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!latestPolicyDraft) {
      console.error(
        `[DigestGenerator] No policy draft found for questionId: ${questionId}`
      );
      return;
    }
    console.log(
      `[DigestGenerator] Found latest policy draft: "${latestPolicyDraft.title}"`
    );

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `あなたはAIアシスタントです。あなたの任務は、中心的な問い（「私たちはどのようにして...できるか？」）、その問いに関連する問題点と解決策、そして政策ドラフトを分析し、一般市民向けに読みやすく噛み砕いたダイジェストを作成することです。

あなたの出力は、'title'（文字列）と'content'（文字列）のキーを含むJSONオブジェクトにする必要があります。

以下のガイドラインに従ってください：

1. あなたは政策レポートとそのデータを読みこなせる専門家であり、本レポート（digest）はそれを一般人向けに噛み砕くライターである必要があります。政策レポートより平易な表現を使いましょう。

2. 複雑な概念や専門用語を避け、平易な言葉で説明してください。

3. 重要なポイントを強調し、細かい詳細よりも全体像を伝えることに重点を置いてください。

4. なぜこの政策が重要なのか、どのように市民の生活に影響するのかを明確に説明してください。

5. 視覚的に読みやすい構造（見出し、箇条書き、短い段落など）を使用してください。

6. 正確さを保ちながらも、簡潔さを優先してください。

7. 政策提案の背景にある主要な問題や課題を簡潔に説明してください。

8. 専門的な分析や複雑なトレードオフの詳細よりも、政策の目標と期待される成果に焦点を当ててください。

9. 重要な用語やコンセプトを説明するための簡単な例や比喩を含めてください。

10. 全体の長さは元の政策レポートの約1/3に抑えてください。

応答は、"title"（文字列、ダイジェスト全体に適したタイトル）と "content"（文字列、Markdownで適切にフォーマットされた内容）のキーを含むJSONオブジェクトのみで行ってください。JSON構造外に他のテキストや説明を含めないでください。`,
      },
      {
        role: "user",
        content: `Generate a digest for the following:

Question: ${question.content}

Related Problems (sorted by relevance - higher items are more relevant to the question):
${problemStatements.length > 0 ? problemStatements.map((p) => `- ${p}`).join("\n") : "- None provided"}

Related Solutions (sorted by relevance - higher items are more relevant to the question):
${solutionStatements.length > 0 ? solutionStatements.map((s) => `- ${s}`).join("\n") : "- None provided"}

Policy Report:
Title: ${latestPolicyDraft.title}
Content: ${latestPolicyDraft.content}

Please provide the output as a JSON object with "title" and "content" keys. The digest should be much more accessible to general readers than the policy report.`,
      },
    ];

    console.log("[DigestGenerator] Calling LLM to generate digest draft...");
    const llmResponse = (await callLLM(
      messages,
      true,
      "google/gemini-2.5-pro-preview-03-25"
    )) as DigestResponse; // Request JSON output with specific model

    if (
      !llmResponse ||
      typeof llmResponse !== "object" ||
      !llmResponse.title ||
      !llmResponse.content
    ) {
      console.error(
        "[DigestGenerator] Failed to get valid JSON response from LLM:",
        llmResponse
      );
      throw new Error(
        "Invalid response format from LLM for digest draft generation."
      );
    }

    console.log(
      `[DigestGenerator] LLM generated digest titled: "${llmResponse.title}"`
    );

    const newDraft = new DigestDraft({
      questionId: questionId,
      policyDraftId: latestPolicyDraft._id,
      title: llmResponse.title,
      content: llmResponse.content,
      sourceProblemIds: problemIds,
      sourceSolutionIds: solutionIds,
      version: 1,
    });

    await newDraft.save();
    console.log(
      `[DigestGenerator] Successfully saved digest draft with ID: ${newDraft._id}`
    );
  } catch (error) {
    console.error(
      `[DigestGenerator] Error generating digest draft for questionId ${questionId}:`,
      error
    );
  }
}

export { generateDigestDraft };
