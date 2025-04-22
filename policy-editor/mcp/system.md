OKです。`github-contribution-mcp` サーバーの実装にフォーカスした詳細な設計書を作成します。既存のMCPクライアント（例: MCP CLI）で動作検証できることを目指します。

---

## MCPサーバー設計書: github-contribution-mcp

### 1. 概要

*   **サーバー名:** `github-contribution-mcp`
*   **目的:** GitHub上の特定リポジトリ・特定ディレクトリ内にあるMarkdownファイルの閲覧、編集、コミット、および関連するプルリクエスト（PR）の作成・更新操作を、MCPクライアント（主にChatbot Server）からのリクエストに応じて実行する。編集履歴はGitHub上で管理し、サーバー自身はステートレスに動作する。
*   **主な機能:**
    *   指定されたブランチへのMarkdownファイルの作成・上書きとコミット。
    *   指定されたブランチに関連するDraft PRの説明文更新。
    *   上記の操作時に、必要に応じてブランチとDraft PRを自動生成。
*   **制限:**
    *   操作対象は指定されたディレクトリ以下の `.md` ファイルのみ。
    *   セキュリティのため、操作対象リポジトリとディレクトリは事前に設定されたものに限定。

### 2. アーキテクチャ

*   **言語:** TypeScript
*   **Node.jsバージョン:** 18.x LTS 以上推奨
*   **主要ライブラリ:**
    *   `@modelcontextprotocol/sdk`: MCPサーバーフレームワーク、プロトコル処理
    *   `@octokit/app`: GitHub App 認証、Installation Token の取得
    *   `@octokit/rest`: GitHub REST API クライアント
    *   `dotenv`: 環境変数管理
    *   `pino` / `pino-pretty`: 構造化ロギング
*   **トランスポート:** Stdio (標準入出力) をデフォルトとする（`@modelcontextprotocol/sdk/server/stdio.js` を使用）
*   **認証:** GitHub App を使用。サーバー起動時に秘密鍵を読み込み、リクエストごとに Installation Token を取得して GitHub API を呼び出す。

### 3. 環境変数

サーバー設定のために以下の環境変数が必要です。`.env` ファイルでの管理を推奨します。

| 環境変数名                 | 説明                                                                 | 必須 | 例                                      |
| :------------------------- | :------------------------------------------------------------------- | :--- | :-------------------------------------- |
| `GITHUB_APP_ID`            | GitHub App の ID                                                     | Yes  | `123456`                                |
| `GITHUB_APP_PRIVATE_KEY`   | GitHub App の秘密鍵 (PEM形式の文字列、改行は `\n` に置換推奨)          | Yes  | `"-----BEGIN RSA PRIVATE KEY-----\n..."` |
| `GITHUB_INSTALLATION_ID`   | GitHub App をインストールしたリポジトリの Installation ID                | Yes  | `98765432`                              |
| `GITHUB_TARGET_OWNER`      | 操作対象リポジトリのオーナー名 (ユーザー名 or Organization名)          | Yes  | `my-org`                                |
| `GITHUB_TARGET_REPO`       | 操作対象リポジトリ名                                                 | Yes  | `policy-proposals`                      |
| `GITHUB_BASE_BRANCH`     | PR作成時のベースブランチ名                                           | Yes  | `main`                                  |
| `LOG_LEVEL`                | ログレベル (`trace`, `debug`, `info`, `warn`, `error`, `fatal`)      | No   | `info` (デフォルト)                     |
| `GITHUB_API_BASE_URL`      | (任意) GitHub Enterprise等を使用する場合のAPIエンドポイント           | No   | `https://github.example.com/api/v3`     |

### 4. MCP 機能 (Tools)

MCPサーバーとして `initialize` に応答し、以下のツールを提供します。

#### 4.1. `initialize` レスポンス

サーバー起動時にクライアントから `initialize` リクエストを受け取り、以下の情報を含むレスポンスを返します。

```json
{
  "capabilities": {
    "tools": {} // ツール機能を提供することを示す
  },
  "serverInfo": {
    "name": "github-contribution-mcp",
    "version": "0.1.0" // package.jsonのバージョンなど
  }
}
```

#### 4.2. ツール: `upsert_file_and_commit`

*   **MCP Method:** `tools/call`
*   **Tool Name:** `upsert_file_and_commit`
*   **説明:** 指定されたブランチにMarkdownファイルを作成または上書きし、コミットします。ブランチが存在しない場合は自動的に作成します。
*   **入力 (`params.arguments`):**
    *   `filePath`: `string` - 必須。`.md` 拡張子でなければならない。
    *   `branchName`: `string` - 必須。作業ブランチ名（例: `user123-energy-policy-revamp-1678886400`）。GitHubのブランチ名制約に従うこと。
    *   `content`: `string` - 必須。更新後のファイル内容全体（UTF-8文字列）。
    *   `commitMessage`: `string` - 必須。コミットメッセージ。
*   **処理フロー:**
    1.  **入力バリデーション:**
        *   `filePath` が `.md` で終わるか、不正なパス (`../` など) を含んでいないか確認。
        *   `branchName`, `content`, `commitMessage` が空でないか確認。
    2.  **GitHubクライアント取得:** `getAuthenticatedOctokit()` を呼び出し、Installation Token で認証された Octokit インスタンスを取得。
    3.  **ブランチ存在確認と作成:** `ensureBranchExists(octokit, branchName)` を呼び出す（`github/utils.ts` 内で実装想定）。
        *   内部で `branchName` の存在を `octokit.rest.git.getRef` で確認。
        *   存在しない場合:
            a.  `GITHUB_BASE_BRANCH` の最新コミットSHAを取得 (`octokit.rest.git.getRef`)。
            b.  新しいブランチを作成 (`octokit.rest.git.createRef`)。`。
    5.  **既存ファイル情報取得:** `octokit.rest.repos.getContent({ ..., path: fullPath, ref: branchName })` を呼び出し、現在のファイルSHAを取得。ファイルが存在しない場合は 404 エラーが返るが、これは正常系として扱う。
    6.  **ファイル作成/更新:** `octokit.rest.repos.createOrUpdateFileContents` を呼び出す。
        *   `owner`, `repo`: 環境変数から取得。
        *   `path`: `fullPath`。
        *   `message`: `commitMessage`。
        *   `content`: `Buffer.from(content, 'utf8').toString('base64')`。
        *   `branch`: `branchName`。
        *   `sha`: 既存ファイル情報取得でSHAが得られた場合のみ設定（更新の場合）。
    7.  **成功レスポンス:** コミット情報 (SHA、HTML URL) を含む `CallToolResult` を返す。
    8.  **エラーハンドリング:** GitHub APIエラーやその他のエラーが発生した場合、エラー内容を含む `CallToolResult` (`isError: true`) を返す。409 Conflict (マージコンフリクトの可能性) など、特定のGitHubエラーはより具体的にハンドリングする。
*   **出力 (`CallToolResult`):**
    *   成功時: `{ content: [{ type: "text", text: "Successfully committed changes to ${filePath} (SHA: ${commitSha}). View file: ${htmlUrl}" }] }`
    *   失敗時: `{ isError: true, content: [{ type: "text", text: "Error processing file ${filePath}: ${errorMessage}" }] }`
*   **アノテーション:**
    ```json
    {
      "title": "Update File and Commit",
      "description": "Creates or updates a specified Markdown file in a branch and commits the changes. Automatically creates the branch if it doesn't exist.",
      "readOnlyHint": false,
      "destructiveHint": false, // 上書きはするが、破壊的というよりは編集
      "idempotentHint": false,  // 同じ内容でもコミットは増える可能性がある
      "openWorldHint": false    // GitHubという閉じた環境内での操作
    }
    ```

#### 4.3. ツール: `update_pr_description`

*   **MCP Method:** `tools/call`
*   **Tool Name:** `update_pr_description`
*   **説明:** 指定されたブランチに対応するオープンなDraft PRのタイトルや説明文（本文）を更新します。もしPRが存在しない場合は、新しいDraft PRを作成します。
*   **入力 (`params.arguments`):**
    *   `branchName`: `string` - 必須。対象の作業ブランチ名。
    *   `description`: `string` - 必須。新しいPRの説明文。
    *   `title`: `string` - (任意) 新しいPRのタイトル。指定しない場合、既存のタイトルを維持するか、新規作成時はデフォルトタイトルを使用。
*   **処理フロー:**
    1.  **入力バリデーション:** `branchName`, `description` が空でないか確認。
    2.  **GitHubクライアント取得:** `getAuthenticatedOctokit()` を呼び出す。
    3.  **PR検索:** `octokit.rest.pulls.list({ ..., head: `${GITHUB_TARGET_OWNER}:${branchName}`, state: 'open' })` を呼び出し、指定ブランチをheadとするオープンなPRを検索。
    4.  **PR特定:**
        *   リストが空の場合: 新しいDraft PRを作成 (`octokit.rest.pulls.create`)。タイトルは入力 `title` があればそれを使用、なければ `WIP: Changes for ${branchName}` など。本文は `description`、`draft: true` を設定。`pull_number` を取得。
        *   リストに複数のPRがある場合 (通常はありえない): 最初のPRを使う。`pull_number` を取得。
        *   PRが1つ見つかった場合: `pull_number` を取得。
    5.  **PR更新:** `octokit.rest.pulls.update` を呼び出し、`pull_number` と `body: description` を指定。入力 `title` が提供されていれば、`title` も更新パラメータに含める。
    6.  **成功レスポンス:** 更新されたPRのURLを含む `CallToolResult` を返す。
    7.  **エラーハンドリング:** GitHub APIエラーが発生した場合、エラー内容を含む `CallToolResult` (`isError: true`) を返す。
*   **出力 (`CallToolResult`):**
    *   成功時: `{ content: [{ type: "text", text: "Successfully updated pull request description. View PR: ${prHtmlUrl}" }] }`
    *   失敗時: `{ isError: true, content: [{ type: "text", text: "Error updating PR description for branch ${branchName}: ${errorMessage}" }] }`
*   **アノテーション:**
    ```json
    {
      "title": "Update Pull Request Description",
      "description": "Updates the title and/or description (body) of the open pull request associated with the specified branch. Creates a draft PR if none exists.",
      "readOnlyHint": false,
      "destructiveHint": false,
      "idempotentHint": true,   // 同じ説明文で何度呼んでも結果は同じ
      "openWorldHint": false
    }
    ```

### 5. 実装詳細

#### 5.1. 主要ファイル構成 (例)

```
src/
├── main.ts           # エントリーポイント、サーバー初期化、トランスポート接続
├── server.ts         # MCP Serverインスタンス、ツールハンドラ登録
├── github/
│   ├── client.ts     # GitHub App認証、Octokitインスタンス生成
│   └── utils.ts      # ブランチ存在確認・作成、PR作成などのヘルパー関数
├── handlers/
│   ├── upsertFile.ts # upsert_file_and_commit ツールハンドラ
│   └── updatePr.ts   # update_pr_description ツールハンドラ
└── config.ts         # 環境変数読み込み・検証
└── logger.ts         # ロガー設定
types/
└── index.d.ts        # 必要であればカスタム型定義
.env.example          # 環境変数テンプレート
package.json
tsconfig.json
```

#### 5.2. GitHub クライアント (`github/client.ts`)

*   `getAuthenticatedOctokit()`:
    *   環境変数から `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID` を読み込む。
    *   `@octokit/app` を使用して GitHub App として認証。
    *   指定された `GITHUB_INSTALLATION_ID` に対する Installation Token を取得。
    *   取得したトークンで認証された `@octokit/rest` インスタンスを生成して返す。
    *   トークンの有効期限を考慮し、必要に応じてキャッシュや再取得の仕組みを導入（`@octokit/app` がある程度ハンドリングしてくれる）。
    *   `GITHUB_API_BASE_URL` が設定されていれば、Octokitの `baseUrl` オプションに設定。

#### 5.3. GitHub ユーティリティ (`github/utils.ts`)

*   `ensureBranchExists(octokit, branchName)`: 上記 `upsert_file_and_commit` の処理フローで説明したブランチの確認・作成ロジックを実装。
*   `findOrCreateDraftPr(octokit, branchName, title, body)`: 指定ブランチに対するオープンなPRを検索し、存在すればその情報を返す。存在しなければ新しいDraft PRを作成してその情報を返す。`update_pr_description` で使用。
*   その他、共通化できるAPI呼び出し（例: ファイル内容取得など）があればここにまとめる。

#### 5.4. エラーハンドリング

*   各ハンドラ内で `try...catch` を使用し、GitHub API呼び出しや内部処理のエラーを捕捉。
*   `@octokit/request-error` をキャッチし、`error.status` (HTTPステータスコード) や `error.message` を基に、より分かりやすいエラーメッセージを生成して `CallToolResult` で返す。
*   レート制限エラー (`error.status === 403` かつヘッダー情報で判断) の場合は、リトライを促すメッセージを含める。
*   予期せぬエラーは適切にログ出力し、汎用的なエラーメッセージを返す。

#### 5.5. ロギング (`logger.ts`, `main.ts`)

*   `pino` を使用し、JSON形式でログを出力（開発時は `pino-pretty` で整形可能）。
*   `LOG_LEVEL` 環境変数でログレベルを制御。
*   リクエストIDのようなものを導入して、一連の処理ログを追跡しやすくするとデバッグに役立つ（MCP SDKがリクエストIDを提供しているか要確認、なければ独自に生成）。

### 6. セットアップと実行

1.  リポジトリをクローン。
2.  `npm install` を実行。
3.  `.env.example` をコピーして `.env` を作成し、必要な環境変数を設定。
4.  `npm run build` (TypeScriptコンパイル)。
5.  `npm start` でサーバーを起動。
6.  別のターミナルから `mcp-cli` などのクライアントを使って接続し、ツールを呼び出して動作を確認。

    ```bash
    # 例: MCP CLI を使ってファイルを更新
    mcp-cli call tools/call --server-command "npm start" '{
      "name": "upsert_file_and_commit",
      "arguments": {
        "filePath": "new-policy.md",
        "branchName": "my-test-branch-1",
        "content": "# New Policy Proposal\n\nThis is the content.",
        "commitMessage": "feat: Add initial draft for new policy"
      }
    }'
    ```

### 7. テスト戦略

*   **ユニットテスト (Jest / Vitest):**
    *   各ハンドラ関数、GitHubユーティリティ関数をテスト。
    *   `@octokit/rest` のメソッド呼び出しはモック化し、様々なAPIレスポンス（成功、各種エラー）に対するハンドラの挙動を検証。
    *   入力バリデーションロジックをテスト。
*   **インテグレーションテスト (任意):**
    *   テスト用のGitHubリポジトリを用意し、実際にサーバーを起動してAPI経由でツールを呼び出し、リポジトリの状態が期待通りに変化するか確認。環境変数をテスト用に切り替える仕組みが必要。
*   **手動テスト:** `mcp-cli` を使って様々なシナリオ（新規ファイル作成、既存ファイル更新、PR説明更新、ブランチ/PR自動生成など）をテスト。

---

この設計書に基づき、各コンポーネントを順に実装していくことで、目的のMCPサーバーを構築できるはずです。特に GitHub API のエラーハンドリングと、ブランチ/PRの自動生成ロジックを丁寧に実装することが重要です。