import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import logger from './logger.js';
// import { z } from 'zod'; // Zod is imported in handlers now
import { handleUpsertFile, upsertFileSchema } from "./handlers/upsertFile.js"; // インポート追加
import { handleUpdatePr, updatePrSchema } from "./handlers/updatePr.js"; // インポート追加

// サーバーインスタンスを作成
const server = new McpServer({
    name: "github-contribution-mcp",
    version: "0.1.0", // package.jsonのバージョンと合わせるのが良い
}); // Remove logger argument, seems not supported in McpServer constructor

// --- ここにツールやリソースのハンドラを追加していく ---

// upsert_file_and_commit ツールを登録
const upsertFileAnnotations = {
    title: "Update File and Commit",
    description: "Creates or updates a specified Markdown file in a branch and commits the changes. Automatically creates the branch and a draft pull request if they don't exist.",
    readOnlyHint: false,
    destructiveHint: false, // 上書きはするが破壊的ではない
    idempotentHint: false, // 同じ内容でもコミットは増える
    openWorldHint: false // GitHubという閉じた環境
};

server.tool(
    "upsert_file_and_commit",
    upsertFileSchema.shape, // Pass the Zod schema shape
    handleUpsertFile // Pass the handler function
    // Remove annotations argument for now
);

// update_pr_description ツールを登録
const updatePrAnnotations = {
    title: "Update Pull Request Title and Description",
    description: "Updates the title and/or description (body) of the open pull request associated with the specified branch.",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true, // 同じ説明文なら結果は同じ
    openWorldHint: false
};

server.tool(
    "update_pr",
    updatePrSchema.shape, // Pass the Zod schema shape
    handleUpdatePr // Pass the handler function
    // Remove annotations argument for now
);

export default server;