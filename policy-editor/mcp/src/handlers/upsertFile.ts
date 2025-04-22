import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getAuthenticatedOctokit } from "../github/client.js";
import { ensureBranchExists } from "../github/utils.js";
import config from "../config.js";
import logger from "../logger.js";
import path from 'path'; // pathモジュールをインポート

export const upsertFileSchema = z.object({
    // Temporarily remove refine to check type error
    filePath: z.string(),
    // filePath: z.string().refine(fp => fp.endsWith('.md') && !fp.includes('..'), {
    //   message: "filePath must end with .md and not contain '..'",
    // }),
    branchName: z.string().min(1),
    content: z.string(), // 空の内容も許可する場合があるため min(1) はつけない
    commitMessage: z.string().min(1),
});

export type UpsertFileInput = z.infer<typeof upsertFileSchema>;

export async function handleUpsertFile(params: UpsertFileInput): Promise<CallToolResult> {
    // Restore refine validation manually inside the handler for now
    if (!params.filePath.endsWith('.md') || params.filePath.includes('..')) {
        return {
            isError: true,
            content: [{ type: "text", text: "Invalid filePath: must end with .md and not contain '..'" }]
        };
    }

    const { filePath, branchName, content, commitMessage } = params;
    const owner = config.GITHUB_TARGET_OWNER;
    const repo = config.GITHUB_TARGET_REPO;
    // Ensure filePath doesn't start with '/' as path.posix.join might behave unexpectedly.
    const fullPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    logger.info({ owner, repo, branchName, fullPath }, `Handling upsert_file_and_commit request`);

    try {
        const octokit = await getAuthenticatedOctokit();

        // 1. ブランチの存在確認・作成
        await ensureBranchExists(octokit, branchName);

        // 2. 既存ファイル情報取得 (SHA取得のため)
        let currentSha: string | undefined = undefined;
        try {
            const { data: contentData } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: fullPath,
                ref: branchName,
            });
            // contentDataが配列の場合 (ディレクトリの場合など) はエラーとするか、適切に処理
            if (Array.isArray(contentData)) {
                throw new Error(`Path ${fullPath} refers to a directory, not a file.`);
            }
            // contentData が null や undefined でないこと、および type プロパティが存在することを確認
            if (contentData && contentData.type === 'file') {
                // contentData が file の場合、sha プロパティが存在することを確認
                if ('sha' in contentData) {
                    currentSha = contentData.sha;
                    logger.debug(`Found existing file ${fullPath} with SHA: ${currentSha}`);
                } else {
                    logger.warn(`Path ${fullPath} is a file but SHA is missing. Proceeding without SHA.`);
                }
            } else if (contentData) {
                logger.warn(`Path ${fullPath} exists but is not a file (type: ${contentData.type}). Proceeding to overwrite.`);
            } else {
                // contentData が null や undefined の場合 (通常は 404 になるはずだが念のため)
                logger.info(`Could not retrieve content data for ${fullPath}. Assuming file does not exist.`);
            }
        } catch (error: any) {
            if (error.status === 404) {
                logger.info(`File ${fullPath} does not exist in branch ${branchName}. Will create it.`);
                // ファイルが存在しない場合はSHAなしで作成に進む (正常系)
            } else {
                logger.error({ error }, `Failed to get content for ${fullPath}`);
                throw error; // その他のエラーは再スロー
            }
        }

        // 3. ファイル作成/更新
        logger.info(`${currentSha ? 'Updating' : 'Creating'} file ${fullPath} in branch ${branchName}`);
        const { data: updateResult } = await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: fullPath,
            message: commitMessage,
            content: Buffer.from(content, 'utf8').toString('base64'),
            branch: branchName,
            sha: currentSha, // 存在する場合のみSHAを指定 (更新)
        });

        const commitSha = updateResult.commit.sha;
        // updateResult.content が null でないことを確認してから html_url にアクセス
        const htmlUrl = updateResult.content?.html_url || '#'; // URLが取得できない場合も考慮
        logger.info(`Successfully committed to ${fullPath} (SHA: ${commitSha})`);

        return {
            content: [{
                type: "text",
                text: `Successfully committed changes to ${filePath} (SHA: ${commitSha}). View file: ${htmlUrl}`
            }]
        };

    } catch (error: any) {
        logger.error({ error, params }, `Error processing upsert_file_and_commit for ${filePath}`);
        // Octokitのエラーオブジェクトから詳細を取得試行
        const errorMessage = error.message || 'Unknown error';
        const status = error.status ? ` (Status: ${error.status})` : '';
        return {
            isError: true,
            content: [{
                type: "text",
                text: `Error processing file ${filePath}: ${errorMessage}${status}`
            }]
        };
    }
}