# 手順書

**前提:**

*   Node.js (npmまたはyarn) がインストールされていること。
*   MongoDBがローカルまたはクラウドで利用可能であること。
*   Gitがインストールされており、基本的な操作ができること。
*   OpenRouterのAPIキーを取得済みであること (`.env` ファイルで管理)。
*   コードエディタ (VSCodeなど) があること。

---

**実装手順:**

**Step 1: プロジェクトセットアップと環境構築**

1.  **プロジェクトディレクトリ作成:** 作業用のディレクトリを作成します。
2.  **Git初期化:** `git init` を実行します。
3.  **バックエンド (Node.js + Express) セットアップ:**
    *   `backend` ディレクトリを作成し、移動 (`cd backend`)。
    *   `npm init -y` (または `yarn init -y`) を実行。
    *   必要なライブラリをインストール: `npm install express mongoose dotenv openai cors` (または `yarn add ...`)。開発用依存として `nodemon` もインストールすると便利 (`npm install -D nodemon`)。
    *   `.gitignore` ファイルを作成し、`node_modules` や `.env` を追加。
    *   `.env` ファイルを作成し、`OPENROUTER_API_KEY=your_key_here` と `MONGODB_URI=your_mongodb_connection_string` を記述。
4.  **フロントエンド (Vite + React/Vue/Svelte + Tailwind) セットアップ:**
    *   プロジェクトルートに戻り (`cd ..`)。
    *   Viteプロジェクトを作成: `npm create vite@latest frontend -- --template react` (Reactの場合。VueやSvelteも可)。
    *   `frontend` ディレクトリに移動 (`cd frontend`)。
    *   Tailwind CSSをセットアップ (Viteの公式ドキュメントに従う: [Install Tailwind CSS with Vite](https://tailwindcss.com/docs/guides/vite))。
    *   `.gitignore` はViteが生成してくれるはず。
5.  **MongoDB準備:** MongoDBサーバーが起動していること、または接続情報が正しいことを確認。データベース名を決めておく (例: `policy_chat_db`)。
> **[完了] Step 1 は完了しました。**
> **引き継ぎ事項:** `backend/.env` ファイルに実際の `MONGODB_URI` と `OPENROUTER_API_KEY` を設定してください。


**Step 2: バックエンド - 基礎とDB接続**

1.  **Expressサーバー起動と基本設定:** `backend/server.js` (または `app.js`) を作成。
    *   **重要:** ファイルの **一番最初** で `dotenv` を読み込みます:
        ```javascript
        import dotenv from 'dotenv';
        dotenv.config();
        ```
    *   `express`, `cors` をインポートします。
        ```javascript
        import express from 'express';
        import cors from 'cors';
        // ... 他のimport
        ```
    *   Expressアプリを初期化し、 **CORSミドルウェアを設定** します。これは **他のミドルウェアやルート設定より前** に記述する必要があります。
        ```javascript
        const app = express();

        // CORSミドルウェアを設定 (フロントエンドのオリジンを許可)
        app.use(cors({
          origin: 'http://localhost:5173', // フロントエンドの開発サーバーアドレス (Viteのデフォルト)
          // 必要に応じて本番環境用に変更
        }));

        app.use(express.json()); // JSONパーサー (corsの後)
        // ... 他のミドルウェア設定
        ```
    *   ポートリッスン処理を記述します。
2.  **MongoDB接続:** `mongoose` を使ってMongoDBに接続する処理を `server.js` の `dotenv.config()` の後に追加。接続成功/失敗をコンソールに出力。
3.  **ヘルスチェックAPI:** `/api/health` エンドポイントを作成し、`{ status: "ok" }` を返す。
4.  **起動スクリプト:** `package.json` の `scripts` に ` "start": "node server.js" ` と ` "dev": "nodemon server.js" ` を追加。
5.  **動作確認:**
    *   `npm run dev` (または `yarn dev`) でバックエンドサーバーを起動。
    *   コンソールにMongoDB接続成功メッセージが表示されるか確認。
    *   ブラウザやPostmanで `http://localhost:<ポート番号>/api/health` にアクセスし、`{ "status": "ok" }` が返ってくるか確認。
> **[完了] Step 2 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドサーバー (`backend/server.js`) が起動し、MongoDBに接続済みです (`npm run dev` で実行中)。
> *   次のステップ (Step 3) は、残りのMongooseデータモデル (`Problem.js`, `Solution.js`, `SharpQuestion.js`, `QuestionLink.js`, `PolicyDraft.js`) を `backend/models` ディレクトリに作成することです (`ChatThread.js` は作成済み)。

**Step 3: バックエンド - データモデル定義 (Mongoose スキーマ)**

1.  `backend/models` ディレクトリを作成。
2.  設計書に基づき、以下のMongooseスキーマファイルを作成:
    *   `ChatThread.js` (`chat_threads` コレクション用)
    *   `Problem.js` (`problems` コレクション用)
    *   `Solution.js` (`solutions` コレクション用)
    *   `SharpQuestion.js` (`sharp_questions` コレクション用)
    *   `QuestionLink.js` (`question_links` コレクション用)
    *   `PolicyDraft.js` (`policy_drafts` コレクション用)
3.  各スキーマには、設計書で定義されたフィールド、データ型、タイムスタンプ (`{ timestamps: true }`) を含める。ObjectIdの参照には `mongoose.Schema.Types.ObjectId` を使用し、`ref` オプションで関連モデル名を指定。
> **[完了] Step 3 は完了しました。**
> **引き継ぎ事項:**
> *   Mongooseデータモデル (`Problem.js`, `Solution.js`, `SharpQuestion.js`, `QuestionLink.js`, `PolicyDraft.js`) を `backend/models` ディレクトリに作成しました。
> *   次のステップ (Step 4) は、`backend/services/llmService.js` を作成し、LLM連携モジュールを実装することです。


**Step 4: バックエンド - LLM連携モジュール**

1.  `backend/services/llmService.js` を作成。
2.  設計書にある `callLLM` 関数の雛形を実装。`openai` ライブラリを初期化し、APIキーを `.env` から読み込む。
3.  簡単なテスト用関数 (例: `testLLM`) を作成し、`callLLM` を使って固定の質問 (例: "Hello!") をOpenRouterに投げ、応答をコンソールに出力する。
4.  **動作確認:** バックエンドサーバー起動時に `testLLM` を実行するなどして、OpenRouter APIとの通信が成功し、応答が得られることを確認。（APIキーが正しく設定されているか？）
> **[完了] Step 4 は完了しました。**
> **引き継ぎ事項:**
> *   `backend/services/llmService.js` にLLM連携モジュール (`callLLM`) とテスト関数 (`testLLM`) を実装しました。
> *   `backend/server.js` を修正し、MongoDB接続成功後に `testLLM` が実行されるようにしました。
> *   **重要:** バックエンドサーバー (`npm run dev` または `yarn dev`) を起動し、コンソールに `testLLM` の実行結果（OpenRouterからの応答またはエラー）が表示されることを確認してください。APIキー (`.env` 内の `OPENROUTER_API_KEY`) が正しく設定されている必要があります。
> *   次のステップ (Step 5) は、バックエンドのチャットAPI (`POST /api/chat/messages`) の基本機能を実装することです。

**Step 5: バックエンド - チャットAPI (基本機能)**

1.  `backend/routes/chatRoutes.js` を作成し、Express Routerを設定。
2.  `POST /api/chat/messages` エンドポイントを作成するコントローラー関数 (`backend/controllers/chatController.js`) を実装。
    *   リクエストボディから `userId` (なければ仮生成) と `message` を受け取る。
    *   `ChatThread` モデルを使用して、該当 `userId` のスレッドを検索または新規作成。
    *   ユーザーメッセージをスレッドの `messages` 配列に追加。
    *   **一旦、AI応答は固定文字列 (例: "...") で返す。**
    *   更新されたスレッドをDBに保存。
    *   固定応答をレスポンスとして返す。
    *   **【推奨】エラーハンドリング:** DB操作や予期せぬリクエストに対応するため、`try...catch` ブロックで処理全体を囲み、エラー発生時には適切なエラーレスポンス (例: ステータスコード 500) を返し、コンソールにエラーログを出力するようにします。
3.  `server.js` で `/api/chat` プレフィックスで `chatRoutes` を使用するよう設定。
4.  **動作確認:** Postman等で `POST /api/chat/messages` に `{ "userId": "testuser", "message": "こんにちは" }` のようなリクエストを送信。固定応答が返り、MongoDB Compass等で `chat_threads` コレクションに会話履歴が保存されることを確認。
> **[完了] Step 5 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドのチャットAPI (`POST /api/chat/messages`) の基本機能（固定応答）を実装し、`backend/server.js` に組み込みました。
> *   動作確認として、Postman等で `POST http://localhost:<ポート>/api/chat/messages` (例: `{"userId": "testuser", "message": "hello"}`) を実行し、固定応答 (`"..."`) が返り、DB (`chat_threads`) にデータが保存されることを確認してください。バックエンドサーバー (`npm run dev`) が起動している必要があります。
> *   次のステップ (Step 6) は、フロントエンドの基本レイアウト (`frontend/src/App.jsx` など) をTailwind CSSを使って作成することです。


**Step 6: フロントエンド - 基本レイアウトとセットアップ**

1.  `frontend` ディレクトリで `npm run dev` (または `yarn dev`) を実行し、開発サーバーを起動。
2.  `src/App.jsx` (または対応するファイル) を編集。
3.  Tailwind CSSを使い、画面全体のレイアウトを作成。
    *   画面下部に固定表示されるチャット入力エリア/ボタンのコンポーネント (`ChatInput.jsx`)。
    *   チャット履歴表示エリアのコンポーネント (`ChatHistory.jsx`)。
    *   画面上部（背景部分）に可視化エリアのプレースホルダー。
    *   必要に応じて状態管理ライブラリ (Zustand, Jotai, Redux Toolkitなど) を導入。
4.  **動作確認:** ブラウザでフロントエンドを表示し、基本的なレイアウト（チャット入力欄、メッセージ表示エリア、上部エリア）が表示されていることを確認。

> **[完了] Step 6 は完了しました。**
> **引き継ぎ事項:**
> *   フロントエンドの基本レイアウト (`frontend/src/App.jsx`, `ChatInput.jsx`, `ChatHistory.jsx`) を作成し、Tailwind CSSでスタイリングしました。
> *   フロントエンド開発サーバー (`npm run dev`) が起動しており、ブラウザで基本的なレイアウトが表示されることを確認済みです。
> *   次のステップ (Step 7) は、フロントエンドのチャット入力 (`ChatInput.jsx`) からバックエンドAPI (`POST /api/chat/messages`) を呼び出す処理を実装することです。

**Step 7: フロントエンド - チャット機能連携**

1.  `ChatInput.jsx` で入力されたメッセージを状態管理。送信ボタンクリック時にバックエンドの `POST /api/chat/messages` を `fetch` や `axios` で呼び出す処理を実装。
2.  `ChatHistory.jsx` でメッセージ履歴（ユーザー発言とAI応答）を表示。APIからの応答を受け取り、履歴に追加して再描画する。
3.  **動作確認:** フロントエンドのチャット入力欄にメッセージを打ち込み送信すると、自分のメッセージが表示され、バックエンドからの（まだ固定の）応答が表示されることを確認。
> **[完了] Step 7 は完了しました。**
> **引き継ぎ事項:**
> *   フロントエンド (`frontend/src/App.jsx`) からバックエンドAPI (`POST /api/chat/messages`) を呼び出し、応答を表示する処理を実装しました。
> *   動作確認として、フロントエンドのチャットでメッセージを送信し、自分のメッセージとバックエンドからの固定応答 (`"..."`) が表示されることを確認してください。フロントエンド (`npm run dev` in `frontend`) とバックエンド (`npm run dev` in `backend`) の両方の開発サーバーが起動している必要があります。
> *   次のステップ (Step 8) は、バックエンドの `chatController.js` を修正し、固定応答の代わりに実際にLLM (`llmService.callLLM`) を呼び出してAI応答を生成するように変更することです。

**Step 8: バックエンド - AI応答の組み込み**

1.  `chatController.js` の `POST /api/chat/messages` 処理を修正。
2.  ユーザーメッセージをスレッドに追加した後、`llmService.callLLM` を呼び出す。
    *   コンテキストとして、現在の `chat_threads.messages` を整形して渡す。
    *   LLMからの応答 (`content`) を取得。
    *   応答メッセージを `role: "assistant"` としてスレッドの `messages` 配列に追加。
    *   スレッドをDBに保存。
    *   LLMの応答をレスポンスとしてフロントエンドに返す。
3.  **動作確認:** フロントエンドからチャットを送ると、固定応答ではなく、LLM (Gemini Flash) が生成した応答が返ってくることを確認。
> **[完了] Step 8 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドのチャットAPI (`backend/controllers/chatController.js`) が、固定応答ではなく `llmService.callLLM` を使用して実際のAI応答を返すように修正されました。
> *   動作確認として、フロントエンドからメッセージを送信し、LLMによって生成された応答がチャット履歴に表示されることを確認してください。フロントエンド (`npm run dev` in `frontend`) とバックエンド (`npm run dev` in `backend`) の両方の開発サーバーが起動している必要があります。OpenRouter APIキーが `.env` で正しく設定されているかも確認してください。
> *   次のステップ (Step 9) は、バックエンドで会話から課題/解決策を非同期で抽出する処理 (`backend/workers/extractionWorker.js`) を実装することです。

**Step 9: バックエンド - 課題/解決策 抽出 (非同期)**

1.  **非同期処理の選択:**
    *   **簡易:** まずは `setTimeout` や `setImmediate` を使い、APIリクエスト処理から抽出ロジックを分離する。（本番向けではない）
    *   **推奨:** `bullmq` や `agenda` 等のキューライブラリを導入するか、MongoDB Change Streams を利用する準備をする。（ここでは簡易版で進めることも可能）
2.  `backend/workers/extractionWorker.js` を作成。抽出ロジック（LLM呼び出し、DB保存/更新）を実装。
    *   引数として `threadId` を受け取る関数 `processExtraction(threadId)` を定義。
    *   `ChatThread` から会話履歴と既存の抽出IDを取得。
    *   `llmService.callLLM` を適切なプロンプト（会話履歴、既存抽出物リスト、JSON出力指示）で呼び出す。
    *   返ってきたJSONをパースし、`Problem` / `Solution` モデルを使ってDBに保存または更新 (`findOneAndUpdate` と `version` インクリメント)。
    *   更新/追加されたIDを `ChatThread` の `extractedProblemIds` / `extractedSolutionIds` に追加 (`$addToSet` などを使用)。
    *   **【推奨】エラーハンドリング:** LLM呼び出し (`callLLM`) やJSONパース、DB操作は失敗する可能性があるため、`processExtraction` 関数内の主要な処理を `try...catch` で囲み、エラーログを出力するようにします。これにより、問題発生時のデバッグが容易になります。
3.  `chatController.js` でユーザーメッセージ処理後、`processExtraction(threadId)` を非同期で呼び出す。（例: `setTimeout(() => processExtraction(thread._id), 0);`）
4.  **動作確認:** チャットを進めると、少し遅れて（非同期処理のため）MongoDBの `problems`, `solutions` コレクションにデータが追加/更新され、`chat_threads` の関連IDリストも更新されることを確認。LLMが期待通りのJSONを返さない場合、プロンプト調整が必要。
> **[完了] Step 9 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドで会話から課題/解決策を非同期で抽出する処理 (`backend/workers/extractionWorker.js`) を実装し、`chatController.js` から呼び出すようにしました。
> *   動作確認として、チャットを進めた際に、コンソールログ (`[ExtractionWorker] ...`) が表示され、MongoDBの `problems`, `solutions`, `chat_threads` コレクションが更新されることを確認してください。LLMの応答によっては空の抽出結果になることもあります。
> *   **注意:** 現在の実装では簡易的な `setTimeout` を使用しています。本番環境では `bullmq` などの堅牢なキューシステムへの移行を検討してください。また、`extractionWorker.js` 内で `// TODO: Trigger linking process here` となっている箇所で、Step 13 で実装するリンキング処理を呼び出す必要があります。
> *   次のステップ (Step 10) は、フロントエンドで抽出された結果を表示する機能 (`GET /api/chat/threads/:threadId/extractions` エンドポイントと `ThreadExtractions.jsx` コンポーネント) を実装することです。

**Step 10: フロントエンド - 抽出結果表示**

1.  バックエンドに `GET /api/chat/threads/:threadId/extractions` エンドポイントを作成 (`chatController.js`)。
    *   `threadId` に紐づく `ChatThread` を取得し、`extractedProblemIds` と `extractedSolutionIds` を使って関連する `problems` と `solutions` の情報をDBから取得 (`populate` または別途クエリ)。
    *   取得した課題/解決策のリストを返す。
2.  フロントエンドに新しいコンポーネント (`ThreadExtractions.jsx`) を作成。
3.  このコンポーネント内で、上記のAPIを定期的に（例: 5秒ごと）呼び出すか、WebSocket (より高度) を使って更新を取得。
4.  取得した課題/解決策リストをチャット画面付近に表示（例: シンプルなリスト形式）。
5.  **動作確認:** チャットを進めると、フロントエンドの指定エリアに、そのスレッドから抽出された課題と解決策が（ほぼ）リアルタイムで表示・更新されることを確認。
> **[完了] Step 10 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドに `GET /api/chat/threads/:threadId/extractions` エンドポイントを実装し、`chatRoutes.js` に登録しました。
> *   フロントエンドに `ThreadExtractions.jsx` コンポーネントを作成し、`App.jsx` に組み込みました。このコンポーネントは5秒ごとに指定された `threadId` の抽出結果をAPIから取得して表示します。
> *   `App.jsx` は `localStorage` を使用して `userId` を保持し、バックエンドからの応答で `threadId` を取得・更新するように修正されました。
> *   **動作確認:** フロントエンド (`npm run dev` in `frontend`) とバックエンド (`npm run dev` in `backend`) を起動し、チャットで会話を進めると、チャット履歴の下に「Extracted Insights:」セクションが表示され、非同期で抽出された課題/解決策が更新されることを確認してください。
> *   次のステップ (Step 11) は、バックエンドのAI応答生成時に、DBから他の意見（既存の課題/解決策）を参照して応答に含めるように `chatController.js` を修正することです。

**Step 11: バックエンド - 他者意見参照の組み込み**

1.  `chatController.js` のAI応答生成ロジック (`callLLM` を呼ぶ前) を修正。
2.  DBの `problems` と `solutions` からランダムに数件（または何らかのロジックで関連性のありそうなものを）取得。
3.  取得した課題/解決策の `combinedStatement` / `statement` を整形し、LLMに渡すコンテキスト (messages配列の前など) に追加。「参考情報として、他のユーザーからはこのような意見があります。これらも踏まえて応答してください。適宜、これらの意見についてユーザーに質問したり、関連付けたりしてみてください。」のような指示を追加。
4.  **動作確認:** チャット中にAIが「他の方からは〇〇という課題も出ていますが、どう思いますか？」のような、他の意見に言及する応答をするようになるか確認。
> **[完了] Step 11 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドのチャットAPI (`backend/controllers/chatController.js`) が、AI応答生成時にDBからランダムな課題/解決策を取得し、参考情報としてLLMに渡すように修正されました。
> *   動作確認として、チャット中にAIが他の意見（例: 「他の方からは〇〇という課題も出ていますが、どう思いますか？」）に言及する応答をするか確認してください。フロントエンドとバックエンドの開発サーバーが起動している必要があります。DBに課題/解決策データが存在しない場合は、この機能は動作しません。
> *   次のステップ (Step 12) は、バックエンドでシャープな問いを生成する機能 (`backend/workers/questionGenerator.js` と関連API) を実装することです。


**Step 12: バックエンド - シャープな問い 生成**

1.  `backend/workers/questionGenerator.js` を作成。`generateSharpQuestions()` 関数を定義。
    *   `Problem` モデルから `combinedStatement` を全て取得。
    *   `llmService.callLLM` を適切なプロンプト（課題リスト、HMW形式指示、JSON出力指示）で呼び出す。
    *   返ってきたJSONから問いのリストを取得。
    *   各問いを `SharpQuestion` モデルを使ってDBに保存 (`insertOne` や `insertMany`)。重複チェックは必要に応じて行う。
2.  手動トリガー用API `POST /api/admin/generate-questions` を作成 (`backend/routes/adminRoutes.js`, `backend/controllers/adminController.js`)。このAPIが `generateSharpQuestions()` を呼び出す。
3.  **動作確認:** Postman等で `POST /api/admin/generate-questions` を実行。`sharp_questions` コレクションに問いが生成されることを確認。LLMの応答形式が不安定ならプロンプト調整。

> **[完了] Step 12 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドにシャープな問いを生成するワーカー (`backend/workers/questionGenerator.js`) と、それを手動でトリガーするAPI (`POST /api/admin/generate-questions`) を実装しました。
> *   **動作確認:** バックエンドサーバー (`npm run dev` in `backend`) を起動し、Postman等で `POST http://localhost:<ポート>/api/admin/generate-questions` を実行してください。コンソールログ (`[QuestionGenerator] ...`) が表示され、MongoDBの `sharp_questions` コレクションに問いが生成されることを確認してください。DBの `problems` コレクションにデータがないと問いは生成されません。LLMの応答によっては空の結果になることもあります。
> *   **注意:** `questionGenerator.js` 内で `// TODO: Trigger linking process here` となっている箇所で、次の Step 13 で実装するリンキング処理を呼び出す必要があります。
> *   次のステップ (Step 13) は、バックエンドで課題/解決策と問いを関連付けるリンキング処理 (`backend/workers/linkingWorker.js`) を実装することです。

**Step 13: バックエンド - リンキング処理**

1.  `backend/workers/linkingWorker.js` を作成。`linkItemToQuestions(itemId, itemType)` 関数を定義。
    *   `itemType` に応じて `Problem` または `Solution` から対象アイテムを取得。
    *   `SharpQuestion` を全て取得。
    *   各 `SharpQuestion` について、`llmService.callLLM` を適切なプロンプト（問い、課題/解決策、判定指示、JSON出力指示）で呼び出す。
    *   応答JSONをパースし、関連性があれば `QuestionLink` モデルを使ってDBにリンク情報 (`questionId`, `linkedItemId`, `linkedItemType`, `linkType` など) を保存 (`findOneAndUpdate` で `upsert: true` を使うと便利)。
2.  課題/解決策が追加/更新された際 (`extractionWorker.js` のDB保存後) に `linkItemToQuestions` を呼び出す処理を追加。（非同期）
3.  問いが生成された際 (`questionGenerator.js` のDB保存後) に、全ての課題/解決策に対して `linkItemToQuestions` を呼び出す処理を追加。（非同期、負荷に注意）
    *   **代替:** Change Streamsを `problems`, `solutions`, `sharp_questions` コレクションに対して設定し、変更を検知して `linkingWorker` を起動する。
4.  **動作確認:** 課題/解決策の追加・更新、または問いの生成後、少し待ってから `question_links` コレクションに関連データが生成されていることを確認。

> **[完了] Step 13 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドに課題/解決策と問いを関連付けるリンキング処理 (`backend/workers/linkingWorker.js`) を実装しました。
> *   `extractionWorker.js` と `questionGenerator.js` は、それぞれ新しい課題/解決策または問いが保存された後に、非同期で `linkingWorker.js` の関数 (`linkItemToQuestions` または `linkQuestionToAllItems`) を呼び出すように修正されました。
> *   **動作確認:** チャットで会話を進めて課題/解決策が抽出された後、または `POST /api/admin/generate-questions` を実行して問いが生成された後、しばらく待ってから MongoDB の `question_links` コレクションに関連データが生成・更新されることを確認してください。コンソールログ (`[LinkingWorker] ...`) も確認してください。LLMの応答によってはリンクが生成されない場合もあります。
> *   **注意:** 現在の非同期呼び出しは簡易的な `setTimeout` を使用しています。負荷やエラーハンドリングを考慮すると、本番環境では `bullmq` や Change Streams などのより堅牢な仕組みへの移行を検討してください。
> *   次のステップ (Step 14) は、フロントエンドで問いとそれに関連する課題/解決策を表示する可視化エリアを実装することです。


**Step 14: フロントエンド - 可視化エリアの実装**

1.  バックエンドに `GET /api/questions` と `GET /api/questions/:questionId/details` エンドポイントを作成 (`backend/routes/questionRoutes.js`, `backend/controllers/questionController.js`)。
    *   `/api/questions`: `SharpQuestion` を全件取得して返す。
    *   `/api/questions/:questionId/details`:
        *   指定IDの `SharpQuestion` を取得。
        *   `QuestionLink` を使って、その `questionId` に紐づく `problems` と `solutions` のIDリストを取得。
        *   取得したIDリストを使って、実際の `Problem` と `Solution` のデータを取得 (`populate` または別途クエリ）。
        *   問いの情報、関連する課題リスト、関連する解決策リストをまとめて返す。
2.  フロントエンドの画面上部コンポーネント (`VisualizationArea.jsx`) を実装。
    *   まず `/api/questions` を呼び出し、問いのリストを表示（例: タブ、アコーディオン、カードリスト）。
    *   ユーザーが特定の問いを選択したら、`/api/questions/:questionId/details` を呼び出す。
    *   取得した詳細データ（問い、関連課題、関連解決策）を分かりやすく表示（例: 問いの下に課題カードと解決策カードを並べる）。
3.  **動作確認:** フロントエンドで問いを選択すると、それに関連付けられた課題と解決策が表示されることを確認。表示形式は適宜調整。
> **[完了] Step 14 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドに問い一覧 (`GET /api/questions`) と問い詳細 (`GET /api/questions/:questionId/details`) を取得するAPIを実装し、`server.js` に登録しました。
> *   フロントエンドに `VisualizationArea.jsx` コンポーネントを作成し、`App.jsx` に組み込みました。このエリアでは、APIから取得した問い一覧を表示し、問いを選択すると関連する課題と解決策が表示されます。
> *   **動作確認:** フロントエンド (`npm run dev` in `frontend`) とバックエンド (`npm run dev` in `backend`) を起動し、画面上部の可視化エリアに問いが表示されるか、問いを選択すると詳細が表示されるかを確認してください。DBに問い (`sharp_questions`) とリンク (`question_links`) のデータが存在する必要があります。
> *   次のステップ (Step 15) は、バックエンドで政策ドラフトを生成する機能 (`backend/workers/policyGenerator.js` と関連API) を実装することです。

**Step 15: バックエンド - 政策ドラフト生成**

1.  `backend/workers/policyGenerator.js` を作成。`generatePolicyDraft(questionId)` 関数を定義。
    *   `questionId` に紐づく `SharpQuestion` を取得。
    *   `QuestionLink` を使って関連する `Problem` と `Solution` のステートメントを取得。
    *   `llmService.callLLM` を適切なプロンプト（問い、課題リスト、解決策リスト、政策生成指示、JSON出力指示）で呼び出す。
    *   応答JSONからタイトルと本文を取得し、`PolicyDraft` モデルを使ってDBに保存。
2.  トリガー用API `POST /api/questions/:questionId/generate-policy` を作成 (`questionController.js`)。このAPIが `generatePolicyDraft(questionId)` を非同期で呼び出す。
3.  **動作確認:** Postman等で適当な問いIDを指定して `POST /api/questions/:questionId/generate-policy` を実行。`policy_drafts` コレクションにドラフトが生成されることを確認。
> **[完了] Step 15 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドに政策ドラフトを生成するワーカー (`backend/workers/policyGenerator.js`) と、それをトリガーするAPI (`POST /api/questions/:questionId/generate-policy`) を実装しました。
> *   **動作確認:** バックエンドサーバー (`npm run dev` in `backend`) を起動し、Postman等で有効な問いID (`sharp_questions` コレクションから取得) を使って `POST http://localhost:<ポート>/api/questions/:questionId/generate-policy` を実行してください。コンソールログ (`[PolicyGenerator] ...`) が表示され、MongoDBの `policy_drafts` コレクションにドラフトが生成されることを確認してください。関連する問い、課題、解決策がDBに存在する必要があります。
> *   **注意:** 現在の非同期呼び出しは簡易的な `setTimeout` を使用しています。本番環境では `bullmq` などの堅牢なキューシステムへの移行を検討してください。
> *   次のステップ (Step 16) は、フロントエンドで政策ドラフト表示と生成トリガーを実装することです。

**Step 16: フロントエンド - 政策ドラフト表示と生成トリガー**

1.  バックエンドに `GET /api/policy-drafts` エンドポイントを作成 (`backend/routes/policyRoutes.js`, `backend/controllers/policyController.js`)。必要に応じて `questionId` でフィルタリングできるようにする。
2.  フロントエンドの可視化エリア (`VisualizationArea.jsx`) または別ページに、政策ドラフトを表示する機能を追加。
    *   `/api/policy-drafts` を呼び出してドラフト一覧（または特定の問いに関連するもの）を表示。
3.  各「シャープな問い」の表示部分に「政策ドラフト生成」ボタンを追加。クリックすると `POST /api/questions/:questionId/generate-policy` を呼び出す。
4.  **動作確認:** フロントエンドで問いを選び、生成ボタンを押すと、しばらくして（非同期処理完了後）その問いに対応する政策ドラフトが表示されることを確認。
> **[完了] Step 16 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドに政策ドラフト取得API (`GET /api/policy-drafts`) を実装し、`server.js` に登録しました。
> *   フロントエンドの `VisualizationArea.jsx` を修正し、選択された問いに関連する政策ドラフトを表示する機能と、「政策ドラフト生成」ボタンを追加しました。
> *   **動作確認:** フロントエンド (`npm run dev` in `frontend`) とバックエンド (`npm run dev` in `backend`) を起動し、問いを選択して「政策ドラフト生成」ボタンをクリックしてください。しばらくすると（デフォルト10秒後）、生成されたドラフトが（存在すれば）表示エリアに現れることを確認してください。DBに問い、関連する課題/解決策が存在する必要があります。
> *   **注意:** ドラフト表示は現在、生成トリガー後10秒の遅延を経て自動更新されます。よりリアルタイムな更新が必要な場合は、WebSocketやServer-Sent Events (SSE) の導入を検討してください。
> *   次のステップ (Step 17) は、バックエンドで課題/解決策データを一括インポートする機能 (`POST /api/import/...`) を実装することです。

**Step 17: バックエンド - データインポート機能**

1.  `backend/routes/importRoutes.js`, `backend/controllers/importController.js` を作成。
2.  `POST /api/import/problems`, `POST /api/import/solutions` エンドポイントを実装。
    *   リクエストボディ（例: JSON配列）から課題/解決策データを受け取る。
    *   各データを `Problem` / `Solution` モデルを使ってDBに保存。`sourceType` を `bulk_import` に設定。
    *   保存後、各アイテムに対して `linkingWorker.linkItemToQuestions` を非同期で呼び出す。
3.  **動作確認:** JSON形式などで課題/解決策データを用意し、Postman等でインポートAPIを叩く。データがDBに保存され、`sourceType` が正しく設定され、リンキング処理が（非同期に）実行されることを確認。
> **[完了] Step 17 は完了しました。**
> **引き継ぎ事項:**
> *   バックエンドに課題/解決策データを一括インポートするAPI (`POST /api/import/problems`, `POST /api/import/solutions`) を実装しました。
> *   **動作確認:** バックエンドサーバー (`npm run dev` in `backend`) を起動し、Postman等で `POST http://localhost:<ポート>/api/import/problems` または `/api/import/solutions` に、課題/解決策オブジェクトのJSON配列をリクエストボディとして送信してください。コンソールログ (`[ImportController] ...`) が表示され、MongoDBの `problems`/`solutions` コレクションにデータが保存され (`sourceType` が `bulk_import` になっていること)、`question_links` コレクションの更新（非同期）がトリガーされることを確認してください。
> *   **注意:** 現在のリンキング処理呼び出しは簡易的な `setTimeout` を使用しています。本番環境では `bullmq` などの堅牢なキューシステムへの移行を検討してください。
> *   次のステップ (Step 18) は、全体的な調整とテストです。

Step 18: 管理パネル (Admin Panel) の実装

フロントエンドに管理パネル用のコンポーネント (frontend/src/components/AdminPanel.jsx) を作成。
シンプルなUI（カード形式）で、以下の機能を提供:
シャープな問い生成ボタン (POST /api/admin/generate-questions を呼び出す)
問い一覧の表示と管理 (GET /api/questions を使用)
課題/解決策の一覧表示と管理 (GET /api/problems, GET /api/solutions を実装・使用)
政策ドラフト一覧の表示 (GET /api/policy-drafts を使用)
バックエンドに必要な追加APIを実装:
GET /api/problems と GET /api/solutions エンドポイントを作成 (backend/routes/adminRoutes.js に追加)
必要に応じて、問い/課題/解決策の削除や編集用APIも実装
管理パネルへのアクセス制御 (オプション):
簡易的なパスワード保護や、特定のURLパスでのみアクセス可能にする
本番環境では、より堅牢な認証システムの導入を検討
App.jsx に管理パネルへのリンクやボタンを追加 (例: 画面右上の歯車アイコン)
動作確認: 管理パネルにアクセスし、シャープな問い生成ボタンをクリックして問いが生成されるか、各種データの一覧が正しく表示されるかを確認。

**Step 19: 全体調整とテスト**

1.  一通りの機能をユーザー視点で操作し、動作を確認。
2.  UI/UXの微調整（Tailwindのクラス調整など）。
3.  コンソールに出力されるエラーや警告を確認し、修正。
4.  特に非同期処理の連携（抽出→リンキング、問い生成→リンキング、インポート→リンキング、政策生成）が意図通り機能するか確認。
5.  簡単な README ファイルを作成し、セットアップ方法や起動方法を記述。

---

これでプロトタイプの実装が一通り完了するはずです。各ステップでの動作確認を丁寧に行うことで、問題の早期発見と修正が可能です。頑張ってください！