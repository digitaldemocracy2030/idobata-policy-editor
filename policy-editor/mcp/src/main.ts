import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import server from './server.js';
import logger from './logger.js';
import config from './config.js'; // 環境変数を読み込むため
import { getAuthenticatedOctokit } from './github/client.js'; // Import the client

async function main() {
    logger.info(`Starting github-contribution-mcp server (Log Level: ${config.LOG_LEVEL || 'info'})...`);

    // Stdioトランスポートを作成
    const transport = new StdioServerTransport();

    try {
        // サーバーをトランスポートに接続
        await server.connect(transport);
        logger.info("Server connected via Stdio. Waiting for requests...");
    } catch (error) {
        logger.error({ error }, "Failed to connect server");
        process.exit(1);
    }

    // --- Temporary GitHub Authentication Test ---
    try {
        logger.info("Testing GitHub authentication...");
        const octokit = await getAuthenticatedOctokit();
        // Use octokit.rest.apps.getAuthenticated() which is available on the InstallationOctokit type
        const { data: appData } = await octokit.rest.apps.getAuthenticated();
        // Safely access appData.name with optional chaining
        logger.info(`Authenticated as GitHub App: ${appData?.name || 'Unknown App Name'}`);
        const { data: repoData } = await octokit.rest.repos.get({
            owner: config.GITHUB_TARGET_OWNER,
            repo: config.GITHUB_TARGET_REPO,
        });
        logger.info(`Successfully accessed target repository: ${repoData.full_name}`);
        logger.info("GitHub authentication test successful.");
    } catch (error) {
        logger.error({ error }, "GitHub authentication test failed.");
        // Optionally exit if auth fails, depending on requirements
        // process.exit(1);
    }
    // --- End Temporary Test ---
}

main();