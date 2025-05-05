import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import config from "../config.js";
import { getAuthenticatedOctokit } from "../github/client.js";
import { findOrCreateDraftPr } from "../github/utils.js"; // findOrCreateDraftPr をインポート
import { extractDocumentName, formatPrTitle } from "../github/prTitleUtils.js"; // 新しい関数をインポート
import logger from "../logger.js";

export const updatePrSchema = z.object({
  branchName: z.string().min(1),
  title: z.string().optional(), // タイトルをオプショナルで追加
  description: z.string(), // 空の説明も許可
  filePath: z.string().optional(), // ファイルパスをオプショナルで追加
  userName: z.string().optional(), // ユーザー名をオプショナルで追加
});

export type UpdatePrInput = z.infer<typeof updatePrSchema>;

export async function handleUpdatePr(
  params: UpdatePrInput
): Promise<CallToolResult> {
  const { branchName, title, description, filePath, userName } = params;
  const owner = config.GITHUB_TARGET_OWNER;
  const repo = config.GITHUB_TARGET_REPO;
  // head format は utils 内で処理されるためここでは不要

  logger.info(
    { owner, repo, branchName, title: !!title },
    "Handling update_pr request"
  );

  try {
    const octokit = await getAuthenticatedOctokit();

    // 1. PRを検索または作成
    // 新規作成時のデフォルトタイトル（title が指定されていない場合に使用）
    const documentName = filePath ? extractDocumentName(filePath) : "";
    const defaultPrTitle = title || formatPrTitle(
      userName || "匿名ユーザー",
      documentName,
      `${branchName}の変更`
    );
    
    // findOrCreateDraftPr は description を新規作成時の body として使用する
    const prInfo = await findOrCreateDraftPr(
      octokit,
      branchName,
      defaultPrTitle,
      description
    );
    const pull_number = prInfo.number;
    const prHtmlUrl = prInfo.html_url; // PRのURLを取得

    // 2. PRの説明文を更新
    // 2. PRのタイトルと説明文を更新
    const updatePayload: {
      owner: string;
      repo: string;
      pull_number: number;
      body: string;
      title?: string;
    } = {
      owner,
      repo,
      pull_number,
      body: description,
    };

    if (title) {
      updatePayload.title = title;
      logger.info(`Updating title and description for PR #${pull_number}`);
    } else {
      logger.info(`Updating description for PR #${pull_number}`);
    }

    const { data: updatedPr } = await octokit.rest.pulls.update({
      ...updatePayload,
    });

    // findOrCreateDraftPr で作成された場合、description は既に設定されているが、
    // 既存PRの場合に更新が必要なため、常に update を呼び出す (冪等性のため問題ない)
    const updatedFields = title ? "title and description" : "description";
    logger.info(
      `Successfully ensured PR #${pull_number} exists and updated ${updatedFields}. URL: ${prHtmlUrl}`
    );

    return {
      content: [
        {
          type: "text",
          text: `Successfully updated pull request ${updatedFields}. View PR: ${prHtmlUrl}`, // 取得したURLを使用
        },
      ],
    };
  } catch (error: unknown) {
    logger.error(
      { error, params },
      `Error processing update_pr for branch ${branchName}`
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const status =
      error instanceof Error && "status" in error
        ? ` (Status: ${error.status})`
        : "";
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error updating PR for branch ${branchName}: ${errorMessage}${status}`,
        },
      ],
    };
  }
}
