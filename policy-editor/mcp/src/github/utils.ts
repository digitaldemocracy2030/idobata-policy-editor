import { Octokit } from "@octokit/rest";
import config from "../config.js";
import logger from "../logger.js";
import path from 'path'; // pathモジュールをインポート

/**
 * 指定されたブランチが存在することを確認し、存在しない場合は作成する。
 * @param octokit 認証済みOctokitインスタンス
 * @param branchName 作業ブランチ名
 * @throws エラーが発生した場合
 */
export async function ensureBranchExists(
    octokit: Octokit,
    branchName: string
): Promise<void> {
    const owner = config.GITHUB_TARGET_OWNER;
    const repo = config.GITHUB_TARGET_REPO;
    const baseBranch = config.GITHUB_BASE_BRANCH;
    const head = `${owner}:${branchName}`;

    logger.info(`Ensuring branch ${branchName} exists...`);

    let branchExists = false;
    try {
        await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branchName}`,
        });
        branchExists = true;
        logger.info(`Branch ${branchName} already exists.`);
    } catch (error: any) {
        if (error.status === 404) {
            logger.info(`Branch ${branchName} does not exist. Creating...`);
            // ブランチが存在しない場合は作成に進む
        } else {
            logger.error({ error }, `Failed to check branch ${branchName}`);
            throw error; // その他のエラーは再スロー
        }
    }

    if (!branchExists) {
        try {
            // 1. ベースブランチの最新コミットSHAを取得
            const { data: baseRefData } = await octokit.rest.git.getRef({
                owner,
                repo,
                ref: `heads/${baseBranch}`,
            });
            const baseSha = baseRefData.object.sha;
            logger.debug(`Base branch (${baseBranch}) SHA: ${baseSha}`);

            // 2. 新しいブランチを作成
            await octokit.rest.git.createRef({
                owner,
                repo,
                ref: `refs/heads/${branchName}`,
                sha: baseSha,
            });
            logger.info(`Branch ${branchName} created from ${baseBranch}.`);
            branchExists = true; // 作成成功
        } catch (error) {
            logger.error({ error }, `Failed to create branch ${branchName}`);
            throw error;
        }
    }

    // ブランチの存在確認・作成は完了
}


/**
 * 指定されたブランチに対応するオープンなDraft PRを検索し、
 * 存在しない場合は作成する。
 * @param octokit 認証済みOctokitインスタンス
 * @param branchName 作業ブランチ名
 * @param title PRのタイトル (新規作成時に使用)
 * @param body PRの本文 (新規作成時に使用)
 * @returns PRの情報 { number: number, html_url: string }
 * @throws エラーが発生した場合
 */
export async function findOrCreateDraftPr(
    octokit: Octokit,
    branchName: string,
    title: string,
    body: string
): Promise<{ number: number; html_url: string }> {
    const owner = config.GITHUB_TARGET_OWNER;
    const repo = config.GITHUB_TARGET_REPO;
    const baseBranch = config.GITHUB_BASE_BRANCH;
    const head = `${owner}:${branchName}`;

    logger.info(`Finding or creating draft PR for branch ${branchName}...`);

    try {
        // 既存のオープンなPRを検索
        const { data: existingPrs } = await octokit.rest.pulls.list({
            owner,
            repo,
            state: 'open',
            head: head,
            base: baseBranch,
        });

        if (existingPrs.length > 0) {
            const pr = existingPrs[0];
            logger.info(`Found existing open PR #${pr.number} for branch ${branchName}.`);
            if (existingPrs.length > 1) {
                logger.warn(`Multiple open PRs found for branch ${branchName}. Using the first one: #${pr.number}`);
            }
            return { number: pr.number, html_url: pr.html_url };
        } else {
            logger.info(`No open PR found for branch ${branchName}. Creating draft PR...`);
            // Draft PRを作成
            const { data: newPr } = await octokit.rest.pulls.create({
                owner,
                repo,
                title: title, // 引数で受け取ったタイトルを使用
                head: branchName,
                base: baseBranch,
                body: body, // 引数で受け取った本文を使用
                draft: true,
            });
            logger.info(`Created draft PR #${newPr.number} for branch ${branchName}. URL: ${newPr.html_url}`);
            return { number: newPr.number, html_url: newPr.html_url };
        }
    } catch (error) {
        logger.error({ error }, `Failed to find or create PR for branch ${branchName}`);
        throw error;
    }
}