# idobata-policy-editor

## セットアップと実行方法

### 1. 環境設定
プロジェクトをローカル環境でセットアップし、実行するための手順です。

#### 1.1. リポジトリのクローン
まず、プロジェクトのリポジトリをクローンします。

```bash
git clone https://github.com/digitaldemocracy2030/idobata-policy-editor
```

#### 1.2. 依存関係のインストール＆ビルド
```bash
cd idobata-policy-editor/

# Backend の依存関係インストールとビルド
cd backend
npm install
npm run build
cd ../

# Frontend の依存関係インストール
cd frontend
npm install
cd ../

# GitHub連携MCPサーバー (mcp サブプロジェクト) の依存関係インストールとビルド
cd mcp
npm install
npm run build
cd ../
```

#### 1.3. envファイルの生成と設定
```bash
# Backend の .env ファイルを生成
cp backend/.env.example backend/.env

# Frontend の .env ファイルを生成
cp frontend/.env.example frontend/.env
```
生成された `backend/.env` と `frontend/.env` ファイルをテキストエディタで開き、以下の必須環境変数を中心に、あなたの環境に合わせて設定してください。

**各環境変数の詳細な設定方法や値の取得場所については、`.env`ファイルを参照してください。**


`backend/.env` で設定が必要な主な環境変数:

- `PORT`: Backend サーバーのポート (通常 3001)
- `OPENROUTER_API_KEY`: 取得した OpenRouter API キー
- `CORS_ORIGIN`: Frontend が実行される URL (通常 `http://localhost:5173`)
- `MCP_SERVER_PATH`: GitHub連携MCPサーバーのビルド済みファイルへのパス (`../mcp/dist/main.js`)
- `GITHUB_APP_ID`: 取得した GitHub App ID
- `GITHUB_APP_PRIVATE_KEY`: GitHub App 秘密鍵 (.pem) ファイルへのパス
- `GITHUB_INSTALLATION_ID`: 取得した Installation ID
- `GITHUB_TARGET_OWNER`: 対象 GitHub リポジトリのオーナー名
- `GITHUB_TARGET_REPO`: 対象 GitHub リポジトリ名
`frontend/.env` で設定が必要な主な環境変数:

- `VITE_API_BASE_URL`: Backend API の基本 URL (通常 `http://localhost:3001/api`)
- `VITE_GITHUB_REPO_OWNER`: 対象 GitHub リポジトリのオーナー名 (Backend と同じ)
- `VITE_GITHUB_REPO_NAME`: 対象 GitHub リポジトリ名 (Backend と同じ)




### 2.アプリケーションの起動
Backend サーバーと Frontend 開発サーバーをそれぞれ起動します。
```bash
# Backend サーバーを起動
cd backend
npm start & # & をつけるとバックグラウンドで実行されます
cd ../

# Frontend 開発サーバーを起動
cd frontend
npm run dev
```
`npm start &` のように末尾に `&` をつけると、Backend サーバーをバックグラウンドで実行し、続けて Frontend サーバーを起動するコマンドを入力できます。もし `&` を使わない場合は、Backend 起動後に別のターミナルタブを開いて Frontend を起動してください。