# MCPサーバー開発手順書: github-contribution-mcp

## 1. はじめに

このドキュメントは、`system.md` で設計された `github-contribution-mcp` サーバーを開発するための詳細な手順を記述します。`mcp_tutorial.md` を参考に、基本的なMCPサーバーの構築から始め、段階的にGitHub連携機能を追加していきます。各ステップには動作検証手順を含みます。

**開発言語:** TypeScript
**実行環境:** Node.js (v18.x LTS以上推奨)

## 2. フェーズ1: 基本的なMCPサーバーの構築と動作確認

まずは、ツール機能を持たない最小限のMCPサーバーを構築し、クライアント (`mcp-cli`) から接続できることを確認します。

### 2.1. プロジェクト初期化と依存関係のインストール

1.  **プロジェクトディレクトリ作成:**
    ```bash
    mkdir github-contribution-mcp
    cd github-contribution-mcp
    ```
2.  **npm プロジェクト初期化:**
    ```bash
    npm init -y
    ```
3.  **TypeScript 初期化:**
    ```bash
    npm install -D typescript @types/node ts-node nodemon
    npx tsc --init --rootDir src --outDir dist --module commonjs --esModuleInterop --resolveJsonModule --sourceMap --skipLibCheck --forceConsistentCasingInFileNames --strict
    ```
    *   `tsconfig.json` が生成されます。必要に応じて設定を調整してください。
4.  **MCP SDK とロギングライブラリのインストール:**
    ```bash
    npm install @modelcontextprotocol/sdk zod dotenv pino
    npm install -D pino-pretty
    ```
5.  **`package.json` の `scripts` を編集:**
    ```json
    "scripts": {
      "build": "tsc",
      "start": "node dist/main.js",
      "dev": "nodemon --watch src --exec ts-node src/main.ts | pino-pretty"
    },
    ```

### 2.2. 基本的なファイル構成の作成

以下の構成でファイル/ディレクトリを作成します。

```
.
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts         # エントリーポイント
│   ├── server.ts       # MCPサーバー設定
│   ├── logger.ts       # ロガー設定
│   └── config.ts       # 環境変数読み込み
└── dist/               # (tscによって生成される)
```

*   `.gitignore` に `node_modules`, `dist`, `.env` を追加します。

### 2.3. ロガーと環境変数の設定

1.  **`src/logger.ts` の実装:**
    ```typescript
    import pino from 'pino';
    import config from './config';

    const logger = pino({
      level: config.LOG_LEVEL || 'info',
    });

    export default logger;
    ```
2.  **`src/config.ts` の実装:**
    ```typescript
    import dotenv from 'dotenv';
    import { z } from 'zod';

    dotenv.config();

    const envSchema = z.object({
      LOG_LEVEL: z.string().optional(),
      // 今後のステップでGitHub関連の変数を追加
    });

    const parsedEnv = envSchema.safeParse(process.env);

    if (!parsedEnv.success) {
      console.error(
        '❌ Invalid environment variables:',
        JSON.stringify(parsedEnv.error.format(), null, 4)
      );
      process.exit(1);
    }

    export default parsedEnv.data;
    ```
3.  **`.env.example` の作成:**
    ```
    LOG_LEVEL=info
    ```
4.  **`.env` ファイルの作成:** `.env.example` をコピーして `.env` を作成します。

### 2.4. 基本的なMCPサーバーの実装

1.  **`src/server.ts` の実装:**
    ```typescript
    import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
    import logger from './logger';

    // サーバーインスタンスを作成
    const server = new McpServer({
      name: "github-contribution-mcp",
      version: "0.1.0", // package.jsonのバージョンと合わせるのが良い
    }, logger);

    // --- ここにツールやリソースのハンドラを追加していく ---

    // 例: シンプルなツール (後で削除または変更)
    server.tool(
      "ping",
      {}, // 入力スキーマなし
      async () => {
        logger.info('Ping tool called');
        return { content: [{ type: "text", text: "pong" }] };
      }
    );

    export default server;
    ```
2.  **`src/main.ts` の実装 (Stdioトランスポート):**
    ```typescript
    import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
    import server from './server';
    import logger from './logger';
    import config from './config'; // 環境変数を読み込むため

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
    }

    main();
    ```

### 2.5. 動作検証 (フェーズ1)

1.  **ビルド:**
    ```bash
    npm run build
    ```
2.  **サーバー起動:**
    ```bash
    npm start
    # または開発モードで起動
    # npm run dev
    ```
3.  **別のターミナルから `mcp-cli` で接続:**
    *   `mcp-cli` がインストールされていない場合は、`npm install -g @modelcontextprotocol/cli` でインストールします。
    *   `initialize` リクエストを送信してサーバー情報を確認します。
        ```bash
        mcp-cli initialize --server-command "npm start"
        # または開発モードの場合
        # mcp-cli initialize --server-command "npm run dev"
        ```
        以下のようなレスポンスが返れば成功です (version等は異なります)。
        ```json
        {
          "capabilities": {
            "tools": {} // tools機能があることを示す
          },
          "serverInfo": {
            "name": "github-contribution-mcp",
            "version": "0.1.0"
          }
        }
        ```
4.  **`ping` ツールを呼び出す:**
    ```bash
    mcp-cli call tools/call --server-command "npm start" '{ "name": "ping", "arguments": {} }'
    ```
    以下のようなレスポンスが返れば成功です。
    ```json
    {
      "content": [
        {
          "type": "text",
          "text": "pong"
        }
      ]
    }
    ```
    サーバー側のログにも `Ping tool called` が表示されるはずです。

## 3. フェーズ2: GitHub連携機能の実装

基本的なサーバーが動作することを確認できたので、GitHub API と連携する機能を実装していきます。

### 3.1. GitHub関連の依存関係と設定

1.  **Octokit ライブラリのインストール:**
    ```bash
    npm install @octokit/app @octokit/rest
    ```
2.  **環境変数の追加:**
    *   `system.md` の「3. 環境変数」セクションを参照し、必要なGitHub関連の環境変数を `.env.example` と `.env` に追加します。**秘密鍵は `\n` を `\\n` にエスケープして1行で記述するか、ファイルパスを指定する方式を検討します。**
    *   `src/config.ts` の `envSchema` にこれらの変数を追加し、バリデーションを行うように修正します。`GITHUB_APP_PRIVATE_KEY` は `z.string()` で受け取ります。

    ```typescript
    // src/config.ts の修正例
    const envSchema = z.object({
      LOG_LEVEL: z.string().optional(),
      GITHUB_APP_ID: z.string(),
      GITHUB_APP_PRIVATE_KEY: z.string(), // PEM文字列またはファイルパス
      GITHUB_INSTALLATION_ID: z.string(),
      GITHUB_TARGET_OWNER: z.string(),
      GITHUB_TARGET_REPO: z.string(),
      GITHUB_BASE_BRANCH: z.string().default('main'),
      GITHUB_API_BASE_URL: z.string().optional(), // GHE用
    });
    ```
    *   **注意:** 秘密鍵の安全な管理方法（環境変数に直接埋め込む以外の方法、例えばファイルから読み込むなど）を検討してください。ここでは簡単のため環境変数から直接読み込む前提で進めます。

### 3.2. GitHub クライアントの実装

1.  **`src/github/client.ts` の作成:**
    ```typescript
    import { Octokit } from "@octokit/rest";
    import { App } from "@octokit/app";
    import config from "../config";
    import logger from "../logger";
    import fs from 'fs';
    import path from 'path';

    let app: App | null = null;
    let installationOctokit: Octokit | null = null;
    let tokenExpiration: number | null = null;

    function getPrivateKey(): string {
      // 環境変数がファイルパスっぽいか簡易チェック
      if (config.GITHUB_APP_PRIVATE_KEY.includes('/') || config.GITHUB_APP_PRIVATE_KEY.includes('\\')) {
        try {
          // プロジェクトルートからの相対パスと仮定
          const keyPath = path.resolve(process.cwd(), config.GITHUB_APP_PRIVATE_KEY);
           logger.info(`Reading private key from file: ${keyPath}`);
          return fs.readFileSync(keyPath, 'utf8');
        } catch (error) {
          logger.error({ error, path: config.GITHUB_APP_PRIVATE_KEY }, "Failed to read private key from file");
          throw new Error("Could not read GitHub App private key file.");
        }
      } else {
        // 環境変数に直接キーが含まれていると仮定 (改行は \n でエスケープされている想定)
         logger.info("Using private key directly from environment variable.");
        return config.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
      }
    }


    function getApp(): App {
      if (!app) {
        const privateKey = getPrivateKey();
        app = new App({
          appId: config.GITHUB_APP_ID,
          privateKey: privateKey,
          webhooks: { secret: 'dummy-secret' }, // Webhookを使わない場合でも必要
          ...(config.GITHUB_API_BASE_URL && {
            Octokit: Octokit.defaults({ baseUrl: config.GITHUB_API_BASE_URL })
          })
        });
         logger.info("GitHub App initialized.");
      }
      return app;
    }

    export async function getAuthenticatedOctokit(): Promise<Octokit> {
      const now = Date.now();
      // トークンの有効期限が切れているか、マージン（例: 5分）を切っていたら再取得
      if (!installationOctokit || !tokenExpiration || tokenExpiration < (now + 5 * 60 * 1000)) {
        logger.info("Obtaining new GitHub installation token...");
        try {
          const appInstance = getApp();
          const installationId = parseInt(config.GITHUB_INSTALLATION_ID, 10);
          if (isNaN(installationId)) {
            throw new Error("Invalid GITHUB_INSTALLATION_ID. Must be a number.");
          }

          // Installation Access Token を取得
          const installationAccessToken = await appInstance.getInstallationAccessToken({
            installationId: installationId,
          });

          // トークンで認証されたOctokitインスタンスを生成
          installationOctokit = new Octokit({
            auth: installationAccessToken.token,
            ...(config.GITHUB_API_BASE_URL && { baseUrl: config.GITHUB_API_BASE_URL })
          });

          // トークンの有効期限を記録 (Date.parseはミリ秒を返す)
          // GitHubのトークン有効期限は通常1時間
          tokenExpiration = Date.parse(installationAccessToken.expires_at);
          logger.info(`Obtained new GitHub installation token (expires at: ${new Date(tokenExpiration).toISOString()})`);

        } catch (error) {
          logger.error({ error }, "Failed to get GitHub installation token");
          throw new Error("Could not authenticate with GitHub App.");
        }
      } else {
         logger.debug("Using cached GitHub installation token.");
      }
      return installationOctokit;
    }
    ```
    *   秘密鍵の読み込み方法（環境変数直接 or ファイル）を追加しました。
    *   トークンのキャッシュと有効期限チェックを追加しました。

### 3.3. 動作検証 (GitHubクライアント)

1.  **`src/main.ts` に一時的なテストコードを追加:**
    ```typescript
    // src/main.ts の main 関数の最後に追記 (動作確認後削除)
    try {
      logger.info("Testing GitHub authentication...");
      const octokit = await getAuthenticatedOctokit();
      const { data: appData } = await octokit.rest.apps.getAuthenticated();
      logger.info(`Authenticated as GitHub App: ${appData.name}`);
      const { data: repoData } = await octokit.rest.repos.get({
        owner: config.GITHUB_TARGET_OWNER,
        repo: config.GITHUB_TARGET_REPO,
      });
      logger.info(`Successfully accessed target repository: ${repoData.full_name}`);
      logger.info("GitHub authentication test successful.");
    } catch (error) {
      logger.error({ error }, "GitHub authentication test failed.");
    }
    ```
2.  **サーバーを起動 (`npm run dev` or `npm start`)** して、ログに認証成功メッセージとリポジトリ情報が表示されるか確認します。エラーが出る場合は、環境変数（特に `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`, `GITHUB_TARGET_OWNER`, `GITHUB_TARGET_REPO`）やGitHub Appの設定（リポジトリへのインストール、権限）を確認してください。
3.  **確認後、`src/main.ts` に追加したテストコードは削除します。**

### 3.4. `upsert_file_and_commit` ツールの実装

1.  **`src/github/utils.ts` の作成と `ensureBranchAndPrExists` の実装:**
    ```typescript
    import { Octokit } from "@octokit/rest";
    import config from "../config";
    import logger from "../logger";
    import path from 'path'; // pathモジュールをインポート

    /**
     * 指定されたブランチと、それに対応するDraft PRが存在することを確認し、
     * 存在しない場合は作成する。
     * @param octokit 認証済みOctokitインスタンス
     * @param branchName 作業ブランチ名
     * @param filePath 関連するファイルパス (PRタイトル生成用)
     * @returns PRの番号 (存在する場合 or 作成した場合)
     * @throws エラーが発生した場合
     */
    export async function ensureBranchAndPrExists(
      octokit: Octokit,
      branchName: string,
      filePath: string
    ): Promise<number | null> {
      const owner = config.GITHUB_TARGET_OWNER;
      const repo = config.GITHUB_TARGET_REPO;
      const baseBranch = config.GITHUB_BASE_BRANCH;
      const head = `${owner}:${branchName}`;

      logger.info(`Ensuring branch ${branchName} and its PR exist...`);

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

      // ブランチが存在するはずなので、次はPRを確認・作成
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
          return pr.number; // 既存PR番号を返す
        } else {
          logger.info(`No open PR found for branch ${branchName}. Creating draft PR...`);
          // Draft PRを作成
          const prTitle = `WIP: Propose changes in ${path.basename(filePath)}`; // ファイル名のみをタイトルに使用
          const { data: newPr } = await octokit.rest.pulls.create({
            owner,
            repo,
            title: prTitle,
            head: branchName,
            base: baseBranch,
            body: `This PR proposes changes to \`${filePath}\`. Initiated by github-contribution-mcp.`, // 初期本文
            draft: true,
          });
          logger.info(`Created draft PR #${newPr.number} for branch ${branchName}. URL: ${newPr.html_url}`);
          return newPr.number; // 新規作成したPR番号を返す
        }
      } catch (error) {
        logger.error({ error }, `Failed to find or create PR for branch ${branchName}`);
        throw error;
      }
    }
    ```
2.  **`src/handlers/upsertFile.ts` の作成:**
    ```typescript
    import { z } from "zod";
    import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
    import { getAuthenticatedOctokit } from "../github/client";
    import { ensureBranchAndPrExists } from "../github/utils";
    import config from "../config";
    import logger from "../logger";
    import path from 'path'; // pathモジュールをインポート

    export const upsertFileSchema = z.object({
      filePath: z.string().refine(fp => fp.endsWith('.md') && !fp.includes('..'), {
        message: "filePath must end with .md and not contain '..'",
      }),
      branchName: z.string().min(1),
      content: z.string(), // 空の内容も許可する場合があるため min(1) はつけない
      commitMessage: z.string().min(1),
    });

    export type UpsertFileInput = z.infer<typeof upsertFileSchema>;

    export async function handleUpsertFile(params: UpsertFileInput): Promise<CallToolResult> {
      const { filePath, branchName, content, commitMessage } = params;
      const owner = config.GITHUB_TARGET_OWNER;
      const repo = config.GITHUB_TARGET_REPO;
      const fullPath = path.posix.join(targetDir === '.' ? '' : targetDir, filePath); // posix.joinで常に / 区切りに

      logger.info({ owner, repo, branchName, fullPath }, `Handling upsert_file_and_commit request`);

      try {
        const octokit = await getAuthenticatedOctokit();

        // 1. ブランチとPRの存在確認・作成
        await ensureBranchAndPrExists(octokit, branchName, fullPath); // filePathではなくfullPathを渡すように修正

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
          if (contentData.type === 'file') {
            currentSha = contentData.sha;
            logger.debug(`Found existing file ${fullPath} with SHA: ${currentSha}`);
          } else {
             logger.warn(`Path ${fullPath} exists but is not a file (type: ${contentData.type}). Proceeding to overwrite.`);
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
    ```
3.  **`src/server.ts` でツールを登録:**
    ```typescript
    import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
    import logger from './logger';
    import { handleUpsertFile, upsertFileSchema } from "./handlers/upsertFile"; // インポート追加
    // import { handleUpdatePrDescription, updatePrSchema } from "./handlers/updatePr"; // 次のステップで追加

    const server = new McpServer({
      name: "github-contribution-mcp",
      version: "0.1.0",
    }, logger);

    // 以前の ping ツールは削除またはコメントアウト
    // server.tool("ping", ...);

    // upsert_file_and_commit ツールを登録
    server.tool(
      "upsert_file_and_commit",
      upsertFileSchema, // Zodスキーマを渡す
      handleUpsertFile, // ハンドラ関数を渡す
      { // アノテーションを追加
        title: "Update File and Commit",
        description: "Creates or updates a specified Markdown file in a branch and commits the changes. Automatically creates the branch and a draft pull request if they don't exist.",
        readOnlyHint: false,
        destructiveHint: false, // 上書きはするが破壊的ではない
        idempotentHint: false, // 同じ内容でもコミットは増える
        openWorldHint: false // GitHubという閉じた環境
      }
    );

    // update_pr_description ツール (次のステップで追加)
    // server.tool(
    //   "update_pr_description",
    //   updatePrSchema,
    //   handleUpdatePrDescription,
    //   { ... } // アノテーション
    // );


    export default server;
    ```

### 3.5. 動作検証 (`upsert_file_and_commit`)

1.  **サーバーを起動 (`npm run dev` or `npm start`)**
2.  **`mcp-cli` でツールを呼び出す:**
    *   **テスト用のブランチ名** (例: `test-mcp-upsert-1`) と **テスト用のファイルパス** (例: `test/my-doc.md`) を指定します。
    *   **初回実行 (ブランチ・PR・ファイルが存在しない場合):**
        ```bash
        mcp-cli call tools/call --server-command "npm run dev" '{
          "name": "upsert_file_and_commit",
          "arguments": {
            "filePath": "test/my-doc.md",
            "branchName": "test-mcp-upsert-1",
            "content": "# Test Document\n\nThis is the first version.",
            "commitMessage": "feat: Add initial test document via MCP"
          }
        }'
        ```
        *   **期待される結果:**
            *   `mcp-cli` に成功メッセージ (コミットSHA、ファイルURL) が返る。
            *   サーバーログにブランチ作成、PR作成、ファイル作成のログが出力される。
            *   GitHubリポジトリに `test-mcp-upsert-1` ブランチが作成されている。
            *   そのブランチに `test/my-doc.md` ファイルが作成され、指定した内容とコミットメッセージでコミットされている。
            *   `WIP: Propose changes in my-doc.md` のようなタイトルの Draft PR が作成されている。
    *   **2回目実行 (ファイル更新):** 同じブランチ名、ファイルパスで内容を変えて実行します。
        ```bash
        mcp-cli call tools/call --server-command "npm run dev" '{
          "name": "upsert_file_and_commit",
          "arguments": {
            "filePath": "test/my-doc.md",
            "branchName": "test-mcp-upsert-1",
            "content": "# Test Document (Updated)\n\nThis is the second version.",
            "commitMessage": "fix: Update test document via MCP"
          }
        }'
        ```
        *   **期待される結果:**
            *   `mcp-cli` に成功メッセージが返る。
            *   サーバーログにファイル更新のログが出力される (ブランチ/PR作成はスキップされる)。
            *   GitHubリポジトリの `test-mcp-upsert-1` ブランチで `test/my-doc.md` が更新され、新しいコミットが追加されている。
    *   **不正な入力:** `filePath` が `.md` で終わらない、`branchName` が空などの場合にエラーが返ることを確認します。

### 3.6. `update_pr_description` ツールの実装

1.  **`src/handlers/updatePr.ts` の作成:**
    ```typescript
    import { z } from "zod";
    import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
    import { getAuthenticatedOctokit } from "../github/client";
    import config from "../config";
    import logger from "../logger";

    export const updatePrSchema = z.object({
      branchName: z.string().min(1),
      description: z.string(), // 空の説明も許可
    });

    export type UpdatePrInput = z.infer<typeof updatePrSchema>;

    export async function handleUpdatePrDescription(params: UpdatePrInput): Promise<CallToolResult> {
      const { branchName, description } = params;
      const owner = config.GITHUB_TARGET_OWNER;
      const repo = config.GITHUB_TARGET_REPO;
      const head = `${owner}:${branchName}`; // head format: 'owner:branch'

      logger.info({ owner, repo, branchName }, `Handling update_pr_description request`);

      try {
        const octokit = await getAuthenticatedOctokit();

        // 1. 指定ブランチをheadとするオープンなPRを検索
        const { data: prs } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: 'open',
          head: head,
          // base: config.GITHUB_BASE_BRANCH, // baseも指定するとより厳密だが、headだけで十分な場合が多い
        });

        if (prs.length === 0) {
          const message = `No open pull request found for branch ${branchName}.`;
          logger.warn(message);
          return {
            isError: true, // エラーとして扱う
            content: [{ type: "text", text: message }]
          };
        }

        if (prs.length > 1) {
          // 通常はありえないが、念のため警告
          logger.warn(`Multiple open PRs found for branch ${branchName}. Using the first one (PR #${prs[0].number}).`);
        }

        const pr = prs[0];
        const pull_number = pr.number;

        // 2. PRの説明文を更新
        logger.info(`Updating description for PR #${pull_number}`);
        const { data: updatedPr } = await octokit.rest.pulls.update({
          owner,
          repo,
          pull_number,
          body: description,
        });

        logger.info(`Successfully updated description for PR #${pull_number}. URL: ${updatedPr.html_url}`);

        return {
          content: [{
            type: "text",
            text: `Successfully updated pull request description. View PR: ${updatedPr.html_url}`
          }]
        };

      } catch (error: any) {
        logger.error({ error, params }, `Error processing update_pr_description for branch ${branchName}`);
        const errorMessage = error.message || 'Unknown error';
        const status = error.status ? ` (Status: ${error.status})` : '';
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error updating PR description for branch ${branchName}: ${errorMessage}${status}`
          }]
        };
      }
    }
    ```
2.  **`src/server.ts` でツールを登録:** (コメントアウトを解除し、インポートを追加)
    ```typescript
    // src/server.ts
    import { handleUpdatePrDescription, updatePrSchema } from "./handlers/updatePr"; // インポート追加

    // ... (McpServerインスタンス化とupsert_file_and_commit登録) ...

    // update_pr_description ツールを登録
    server.tool(
      "update_pr_description",
      updatePrSchema,
      handleUpdatePrDescription,
      { // アノテーション
        title: "Update Pull Request Description",
        description: "Updates the description (body) of the open pull request associated with the specified branch.",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true, // 同じ説明文なら結果は同じ
        openWorldHint: false
      }
    );

    export default server;
    ```

### 3.7. 動作検証 (`update_pr_description`)

1.  **サーバーを起動 (`npm run dev` or `npm start`)**
2.  **`upsert_file_and_commit` を実行して、テスト用のブランチとPRが存在する状態にする** (まだ実行していなければ)。
3.  **`mcp-cli` で `update_pr_description` ツールを呼び出す:**
    ```bash
    mcp-cli call tools/call --server-command "npm run dev" '{
      "name": "update_pr_description",
      "arguments": {
        "branchName": "test-mcp-upsert-1", # upsertで使ったブランチ名
        "description": "This is the updated PR description.\n\n- Point 1\n- Point 2"
      }
    }'
    ```
    *   **期待される結果:**
        *   `mcp-cli` に成功メッセージ (PR URL) が返る。
        *   サーバーログにPR更新のログが出力される。
        *   GitHub上の対応するPRの説明文が更新されている。
4.  **存在しないブランチ名** を指定した場合や、対応するオープンなPRがない場合に、エラーメッセージが返ることを確認します。

## 4. フェーズ3: リファインメントとテスト

### 4.1. エラーハンドリングの強化

*   `src/handlers/*.ts` 内の `catch` ブロックで、`@octokit/request-error` をインポートして型チェックを行い、`error.status` に応じてより具体的なエラーメッセージを返すように改善します (例: 401 Unauthorized, 403 Forbidden/RateLimited, 404 Not Found, 409 Conflict など)。
*   レートリミットエラーの場合は、リトライを促すメッセージを含めます。

### 4.2. ロギングの改善

*   各処理の開始時、主要なステップ、終了時（成功・失敗）に、関連情報（リクエストパラメータ、処理結果、エラー詳細など）を含むログを出力するようにします。
*   リクエストごと、または一連の操作ごとに一意なID（例: `requestId`）を付与し、ログに含めることで追跡しやすくします（MCP SDKが提供しているか確認、なければ `uuid` などのライブラリで生成）。

### 4.3. テスト戦略の実装

*   **ユニットテスト:**
    *   `jest` または `vitest` を導入します (`npm install -D jest @types/jest ts-jest` or `npm install -D vitest @vitest/coverage-v8`)。
    *   `src/handlers/*.ts` や `src/github/utils.ts` の関数に対してテストを作成します。
    *   `@octokit/rest` のメソッド呼び出しをモック化し (`jest.mock` や `vi.mock`)、様々なAPIレスポンス（成功、各種エラー）に対するハンドラの挙動を検証します。
    *   入力バリデーション (`zod` スキーマ) のテストも行います。
*   **手動テスト:**
    *   `mcp-cli` を使用して、以下のシナリオを網羅的にテストします。
        *   新規ファイル作成（ブランチ/PR自動生成）
        *   既存ファイル更新
        *   PR説明更新
        *   存在しないブランチ/PRに対する操作
        *   不正な入力（ファイルパス、ブランチ名など）
        *   （可能であれば）同時に複数のリクエストを実行した場合の挙動

## 5. まとめ

この手順書に従うことで、`github-contribution-mcp` サーバーを段階的に開発・検証できます。特にGitHub APIとの連携部分、エラーハンドリング、ブランチ/PRの自動生成ロジックを慎重に実装・テストすることが重要です。