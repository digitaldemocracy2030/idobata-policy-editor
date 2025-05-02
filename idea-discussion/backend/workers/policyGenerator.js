import mongoose from "mongoose";
import PolicyDraft from "../models/PolicyDraft.js";
import Problem from "../models/Problem.js";
import QuestionLink from "../models/QuestionLink.js";
import SharpQuestion from "../models/SharpQuestion.js";
import Solution from "../models/Solution.js";
import { callLLM } from "../services/llmService.js";
import { generateEmbeddings, clusterVectors } from "../services/embedding/embeddingService.js";

/**
 * Extract ordered item IDs from a hierarchical cluster tree structure using pre-order traversal
 * @param {Object} node - A node in the hierarchical cluster tree
 * @returns {Array<string>} - Array of item IDs in pre-order traversal order
 */
function extractOrderedIdsFromTree(node) {
  if (!node) return [];

  let ids = [];
  if (node.is_leaf) {
    if (node.item_id) {
      ids.push(node.item_id.toString());
    }
  } else {
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        ids = ids.concat(extractOrderedIdsFromTree(child)); // 子の結果を結合
      }
    }
  }
  return ids;
}

async function generatePolicyDraft(questionId) {
  console.log(
    "[PolicyGenerator] Starting policy draft generation for questionId: " + questionId
  );
  try {
    // 1. Fetch the SharpQuestion
    const question = await SharpQuestion.findById(questionId);
    if (!question) {
      console.error(
        "[PolicyGenerator] SharpQuestion not found for id: " + questionId
      );
      return;
    }
    console.log("[PolicyGenerator] Found question: \"" + question.questionText + "\"");
    
    // Extract themeId from question
    const themeId = question.themeId;

    // 2. Fetch related Problem and Solution statements via QuestionLink with relevanceScore
    const links = await QuestionLink.find({ questionId: questionId });

    // Separate problem and solution links
    const problemLinks = links.filter(
      (link) => link.linkedItemType === "problem"
    );
    const solutionLinks = links.filter(
      (link) => link.linkedItemType === "solution"
    );

    // Extract IDs from links
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

    // 3. Generate/Update embeddings for problems and solutions
    const itemsToEmbed = [];
    
    for (const problem of problems) {
      if (!problem.embeddingGenerated) {
        itemsToEmbed.push({
          id: problem._id.toString(),
          text: problem.statement,
          topicId: themeId.toString(),
          questionId: questionId,
          itemType: "problem",
        });
      }
    }

    for (const solution of solutions) {
      if (!solution.embeddingGenerated) {
        itemsToEmbed.push({
          id: solution._id.toString(),
          text: solution.statement,
          topicId: themeId.toString(),
          questionId: questionId,
          itemType: "solution",
        });
      }
    }

    if (itemsToEmbed.length > 0) {
      console.log(
        "[PolicyGenerator] Generating embeddings for " + itemsToEmbed.length + " items"
      );
      try {
        await generateEmbeddings(itemsToEmbed);
        
        const problemIdsToUpdate = itemsToEmbed
          .filter(item => item.itemType === "problem")
          .map(item => item.id);
        
        const solutionIdsToUpdate = itemsToEmbed
          .filter(item => item.itemType === "solution")
          .map(item => item.id);
          
        if (problemIdsToUpdate.length > 0) {
          await Problem.updateMany(
            { _id: { $in: problemIdsToUpdate } },
            { embeddingGenerated: true }
          );
        }
        
        if (solutionIdsToUpdate.length > 0) {
          await Solution.updateMany(
            { _id: { $in: solutionIdsToUpdate } },
            { embeddingGenerated: true }
          );
        }
        
        console.log(
          "[PolicyGenerator] Successfully generated embeddings"
        );
      } catch (error) {
        console.error(
          "[PolicyGenerator] Error generating embeddings:",
          error
        );
      }
    }

    let problemClusterResult;
    let orderedProblemIds = [];
    try {
      console.log(
        "[PolicyGenerator] Performing hierarchical clustering for problems"
      );
      problemClusterResult = await clusterVectors(
        {
          topicId: themeId.toString(),
          questionId: questionId,
          itemType: "problem",
        },
        "hierarchical",
        {}
      );
      
      // 5. Sort the tree by relevance scores
      if (problemClusterResult?.clusters) {
        function calculateAverageRelevance(node, relevanceScoreMap) {
          if (!node) return { totalScore: 0, count: 0 };
          
          if (node.is_leaf) {
            const score = node.item_id
              ? relevanceScoreMap.get(node.item_id.toString()) || 0
              : 0;
            return { totalScore: score, count: 1 };
          }
          
          let totalScore = 0;
          let count = 0;
          
          if (node.children && Array.isArray(node.children)) {
              for (const child of node.children) {
                const childResult = calculateAverageRelevance(
                  child,
                  relevanceScoreMap
                );
                totalScore += childResult.totalScore;
                count += childResult.count;
              }
            }
            
            return { totalScore, count };
          }
        
        function sortTreeByRelevance(node, relevanceScoreMap) {
          if (!node) return;
          
          if (
            !node.is_leaf &&
            node.children &&
            Array.isArray(node.children) &&
            node.children.length > 0
          ) {
            node.children.sort((a, b) => {
              const aResult = calculateAverageRelevance(a, relevanceScoreMap);
              const bResult = calculateAverageRelevance(b, relevanceScoreMap);
              
              const aAvg =
                aResult.count > 0 ? aResult.totalScore / aResult.count : 0;
              const bAvg =
                bResult.count > 0 ? bResult.totalScore / bResult.count : 0;
              
              return bAvg - aAvg; // 降順
            });
            
            for (const child of node.children) {
              sortTreeByRelevance(child, relevanceScoreMap);
            }
          }
        }
        
        sortTreeByRelevance(problemClusterResult.clusters, relevanceScoreMap);
        
        orderedProblemIds = extractOrderedIdsFromTree(problemClusterResult.clusters);
        console.log(
          "[PolicyGenerator] Extracted " + orderedProblemIds.length + " ordered problem IDs from clusters"
        );
      }
    } catch (error) {
      console.error(
        "[PolicyGenerator] Error clustering problems:",
        error
      );
      throw new Error("Failed to cluster problems: " + error.message);
    }

    let solutionClusterResult;
    let orderedSolutionIds = [];
    try {
      console.log(
        "[PolicyGenerator] Performing hierarchical clustering for solutions"
      );
      solutionClusterResult = await clusterVectors(
        {
          topicId: themeId.toString(),
          questionId: questionId,
          itemType: "solution",
        },
        "hierarchical",
        {}
      );
      
      // Sort the tree by relevance scores
      if (solutionClusterResult?.clusters) {
        
        sortTreeByRelevance(solutionClusterResult.clusters, relevanceScoreMap);
        
        // Extract ordered IDs from the sorted tree
        orderedSolutionIds = extractOrderedIdsFromTree(solutionClusterResult.clusters);
        console.log(
          "[PolicyGenerator] Extracted " + orderedSolutionIds.length + " ordered solution IDs from clusters"
        );
      }
    } catch (error) {
      console.error(
        "[PolicyGenerator] Error clustering solutions:",
        error
      );
      throw new Error("Failed to cluster solutions: " + error.message);
    }

    // Create ordered statements based on the ordered IDs
    const problemsMap = new Map(problems.map(p => [p._id.toString(), p]));
    const solutionsMap = new Map(solutions.map(s => [s._id.toString(), s]));
    
    let orderedProblemStatements = [];
    if (orderedProblemIds.length > 0) {
      orderedProblemStatements = orderedProblemIds
        .map(id => {
          const problem = problemsMap.get(id);
          return problem ? problem.statement : null;
        })
        .filter(Boolean); // Remove any null values
    }
    
    let orderedSolutionStatements = [];
    if (orderedSolutionIds.length > 0) {
      orderedSolutionStatements = orderedSolutionIds
        .map(id => {
          const solution = solutionsMap.get(id);
          return solution ? solution.statement : null;
        })
        .filter(Boolean); // Remove any null values
    }
    
    if (orderedProblemStatements.length === 0 && problems.length > 0) {
      console.log(
        "[PolicyGenerator] Falling back to relevance score ordering for problems"
      );
      // Sort problems and solutions according to the order of IDs (which are already sorted by relevanceScore)
      const sortedProblems = problemIds
        .map((id) => problems.find((p) => p._id.toString() === id.toString()))
        .filter(Boolean); // Remove any undefined values
      
      orderedProblemStatements = sortedProblems.map((p) => p.statement);
    }
    
    if (orderedSolutionStatements.length === 0 && solutions.length > 0) {
      console.log(
        "[PolicyGenerator] Falling back to relevance score ordering for solutions"
      );
      const sortedSolutions = solutionIds
        .map((id) => solutions.find((s) => s._id.toString() === id.toString()))
        .filter(Boolean); // Remove any undefined values
      
      orderedSolutionStatements = sortedSolutions.map((s) => s.statement);
    }
    
    console.log(
      "[PolicyGenerator] Prepared " + orderedProblemStatements.length + " related problems and " + orderedSolutionStatements.length + " related solutions, ordered by hierarchical clustering."
    );

    const messages = [
      {
        role: "system",
        content: "あなたはAIアシスタントです。中心的な問い（「私たちはどのようにして...できるか？」）、関連する問題点のリスト、そして市民からの意見を通じて特定された潜在的な解決策のリストに基づいて、政策文書を作成する任務を負っています。\nあなたの出力は、'content'フィールド内に明確に2つのパートで構成されなければなりません。\n\nPart 1: ビジョンレポート\n- 提供された問題点と解決策の意見を分析し、統合してください。\n- **現状認識**と**理想像**について、それぞれ**合意点**と**相違点**（トレードオフを含む）を整理してください。\n- このパートでは、**どのように解決するか（How）の話は含めず**、課題認識と理想像の明確化に焦点を当ててください。\n- 類似したアイデアやテーマをグループ化してください。\n- 考慮された問題点と解決策の意見の数を明確に述べてください。\n- できる限り具体性が高く、生の声（引用など）を取り入れてください。\n- 特定された合意点と相違点を反映し、市民から提起された主要な懸念事項と提案された理想像を要約してください。\n- このセクションは、現状と目指すべき理想像に関する市民の多様な視点（合意点、相違点、トレードオフ）を理解しようとする政策立案者にとって、情報価値の高いレポートとなるべきです。箇条書きではなく、しっかりとした文章で記述してください。\n- 目標文字数：約7000文字\n\nPart 2: 解決手段レポート\n- Part 1で整理された**合意できている理想像**に向けて、提供された解決策の意見を分析・整理してください。\n- 理想像を実現するための具体的な解決策を提案してください。\n- 類似したアイデアやテーマをグループ化してください。\n- 考慮された解決策の意見の数を明確に述べてください。\n- 提案が市民のフィードバックに基づいていることを示すために、市民の意見からの特定のテーマや提案の数を参照してください（例：「Yに関するM個の提案に基づいて...」）。\n- 現実的で具体的な初期草案を作成することに焦点を当ててください。異なる選択肢間のトレードオフも考慮に入れてください。\n- 箇条書きではなく、しっかりとした文章で記述してください。\n- 目標文字数：約7000文字\n\n応答は、\"title\"（文字列、文書全体に適したタイトル）と \"content\"（文字列、'ビジョンレポート'と'解決手段レポート'の両セクションを含み、Markdownヘッダー（例：## ビジョンレポート、## 解決手段レポート）などを使用して明確に区切られ、フォーマットされたもの）のキーを含むJSONオブジェクトのみで行ってください。JSON構造外に他のテキストや説明を含めないでください。",
      },
      {
        role: "user",
        content: "Generate a report for the following question:\nQuestion: " + question.questionText + "\n\nRelated Problems (ordered by hierarchical clustering - items are grouped by similarity):\n" + (orderedProblemStatements.length > 0 ? orderedProblemStatements.map((p) => "- " + p).join("\n") : "- None provided") + "\n\nRelated Solutions (ordered by hierarchical clustering - items are grouped by similarity):\n" + (orderedSolutionStatements.length > 0 ? orderedSolutionStatements.map((s) => "- " + s).join("\n") : "- None provided") + "\n\nPlease provide the output as a JSON object with \"title\" and \"content\" keys. When considering the problems and solutions, analyze the groupings that emerge from their order to identify common themes and patterns.",
      },
    ];

    console.log(
      "[PolicyGenerator] Calling LLM to generate policy draft..."
    );
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
      "[PolicyGenerator] LLM generated draft titled: \"" + llmResponse.title + "\""
    );

    const newDraft = new PolicyDraft({
      questionId: questionId,
      title: llmResponse.title,
      content: llmResponse.content,
      sourceProblemIds: problemIds, // 元のリンクされたIDs
      sourceSolutionIds: solutionIds, // 元のリンクされたIDs
      version: 1,
    });

    await newDraft.save();
    console.log(
      "[PolicyGenerator] Successfully saved policy draft with ID: " + newDraft._id
    );
  } catch (error) {
    console.error(
      "[PolicyGenerator] Error generating policy draft for questionId " + questionId + ":",
      error
    );
    // Add more robust error handling/reporting if needed
  }
}

export { generatePolicyDraft };
