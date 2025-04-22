# 全体像

AIを介した間接的な対話によって、スケーラブルな熟議と政策立案の基盤を作りたいです。
以下に、ご要望に基づいたシステムの詳細な全体設計とデータ構造の定義を記述します。

## 1. システム概要図 (Conceptual)

```mermaid
graph TD
    subgraph Frontend (Vite + Tailwind)
        UI[User Interface]
        Chat[Chat Component]
        Vis[Visualization Component]
    end

    subgraph Backend (Node.js + Express)
        API[API Endpoints]
        ChatLogic[Chat Handling Logic]
        ExtractionQueue[Extraction Job Queue] --> ExtractionWorker
        LinkingQueue[Linking Job Queue] --> LinkingWorker
        QuestionGenTrigger[Question Generation Trigger] --> QuestionGenWorker
        PolicyGenTrigger[Policy Generation Trigger] --> PolicyGenWorker
        DB[MongoDB Database]
    end

    subgraph Background Workers
        ExtractionWorker[Problem/Solution Extractor (LLM)]
        LinkingWorker[Question Linker (LLM)]
        QuestionGenWorker[Sharp Question Generator (LLM)]
        PolicyGenWorker[Policy Draft Generator (LLM)]
    end

    subgraph External Services
        LLM_API[OpenRouter API (Gemini 2.0 Flash)]
    end

    UI -- User Input --> Chat
    Chat -- Send Message --> API
    API -- Process Chat --> ChatLogic
    ChatLogic -- Generate Response (via LLM_API) --> API
    ChatLogic -- Add Job --> ExtractionQueue
    API -- Send Response --> Chat

    ExtractionWorker -- Read Job --> ExtractionQueue
    ExtractionWorker -- Call LLM --> LLM_API
    ExtractionWorker -- Save Extracted Data --> DB
    ExtractionWorker -- Trigger Linking --> LinkingQueue

    QuestionGenTrigger -- Trigger Job --> QuestionGenWorker
    QuestionGenWorker -- Fetch Problems --> DB
    QuestionGenWorker -- Call LLM --> LLM_API
    QuestionGenWorker -- Save Questions --> DB
    QuestionGenWorker -- Trigger Linking --> LinkingQueue

    LinkingWorker -- Read Job --> LinkingQueue
    LinkingWorker -- Fetch Data --> DB
    LinkingWorker -- Call LLM --> LLM_API
    LinkingWorker -- Save Links --> DB

    PolicyGenTrigger -- Trigger Job --> PolicyGenWorker
    PolicyGenWorker -- Fetch Data & Links --> DB
    PolicyGenWorker -- Call LLM --> LLM_API
    PolicyGenWorker -- Save Draft --> DB

    Vis -- Request Data --> API
    API -- Fetch Visualisation Data --> DB
    API -- Send Data --> Vis

    UI -- Shows --> Vis
    UI -- Shows Thread Extractions --> API --> DB

    %% Connections between workers and DB implicitly exist for fetching/saving data
```

## 2. データ構造定義 (MongoDB Collections)

データベースには以下のコレクションを定義します。

**2.1. `chat_threads`**

ユーザーとAIの一連の会話スレッドを格納します。

```typescript
{
  "_id": ObjectId, // ユニークID (MongoDBデフォルト)
  "userId": String, // ユーザーを識別するID (匿名化 or 認証連携)
  "messages": [
    {
      "role": "user" | "assistant", // 発話者
      "content": String, // 発話内容
      "timestamp": Date // 発話時刻
    }
  ],
  "extractedProblemIds": [ObjectId], // このスレッドから抽出された `problems` のIDリスト
  "extractedSolutionIds": [ObjectId], // このスレッドから抽出された `solutions` のIDリスト
  "createdAt": Date,
  "updatedAt": Date
}
```

**2.2. `problems`**

抽出された「課題」を格納します。

```typescript
{
  "_id": ObjectId, // ユニークID
  "statement": String, // 単体で理解可能な課題文 - LLMが生成/補足
  "sourceOriginId": ObjectId, // 抽出元の `chat_threads` ID または `imported_items` ID
  "sourceType": "chat" | "tweet" | "other_import", // データソース種別
  "originalSnippets": [String], // (任意) 抽出の元になったユーザー発言の断片
  "sourceMetadata": Object, // (任意) ソースに関する追加情報 (例: tweet ID, URL, author)
  "version": Number, // 更新版管理用バージョン番号 (初期値: 1)
  "createdAt": Date,
  "updatedAt": Date
}
```

**2.3. `solutions`**

抽出された「解決策」を格納します。

```typescript
{
  "_id": ObjectId, // ユニークID
  "statement": String, // 解決策の具体的な手段 (単体で理解可能) - LLMが生成/補足
  "sourceOriginId": ObjectId, // 抽出元の `chat_threads` ID または `imported_items` ID
  "sourceType": "chat" | "tweet" | "other_import", // データソース種別
  "originalSnippets": [String], // (任意) 抽出の元になったユーザー発言の断片
  "sourceMetadata": Object, // (任意) ソースに関する追加情報 (例: tweet ID, URL, author)
  "version": Number, // 更新版管理用バージョン番号 (初期値: 1)
  "createdAt": Date,
  "updatedAt": Date
}
```

**2.4. `imported_items`**

外部からインポートされた生のデータを格納します（例: ツイート）。

```typescript
{
  "_id": ObjectId, // ユニークID
  "sourceType": "tweet" | "other", // インポート元の種類
  "content": String, // インポートされた生のコンテンツ (例: ツイート本文)
  "metadata": Object, // (任意) インポート元に関するメタデータ (例: { tweetId: "...", author: "...", url: "...", timestamp: Date })
  "status": "pending" | "processing" | "completed" | "failed", // 処理ステータス
  "extractedProblemIds": [ObjectId], // このアイテムから抽出された `problems` のIDリスト
  "extractedSolutionIds": [ObjectId], // このアイテムから抽出された `solutions` のIDリスト
  "createdAt": Date,
  "processedAt": Date, // (任意) 処理完了時刻
  "errorMessage": String // (任意) エラー発生時のメッセージ
}
```

**2.5. `sharp_questions`**

生成された「シャープな問い」を格納します。

```typescript
{
  "_id": ObjectId, // ユニークID
  "questionText": String, // "How might we..." 形式の問い
  "sourceProblemIds": [ObjectId], // (任意) この問いの生成に使用された `problems` のIDリスト
  "createdAt": Date
}
```

**2.6. `question_links`**

「シャープな問い」と「課題」「解決策」の関連性を格納します。

```typescript
{
  "_id": ObjectId, // ユニークID
  "questionId": ObjectId, // 関連する `sharp_questions` のID
  "linkedItemId": ObjectId, // 関連する `problems` または `solutions` のID
  "linkedItemType": "problem" | "solution", // 関連アイテムの種類
  "linkType": "prompts_question" | "answers_question", // 関連の種類 (課題が問いを提起 / 解決策が問いに回答)
  "relevanceScore": Number, // (任意) LLMによる関連度スコア (例: 0.0 ~ 1.0)
  "rationale": String, // (任意) LLMによる関連性の根拠説明
  "createdAt": Date
}
```

**2.7. `policy_drafts`**

生成された政策ドラフトを格納します。

```typescript
{
  "_id": ObjectId, // ユニークID
  "questionId": ObjectId, // 対象とする `sharp_questions` のID
  "title": String, // 政策ドラフトのタイトル
  "content": String, // 政策ドラフトの本文
  "sourceProblemIds": [ObjectId], // 参考にした `problems` のIDリスト
  "sourceSolutionIds": [ObjectId], // 参考にした `solutions` のIDリスト
  "version": Number, // バージョン番号 (初期値: 1)
  "createdAt": Date
}
```

## 3. 主要コンポーネントと処理フロー

```mermaid
graph TD
    subgraph Frontend (Vite + Tailwind)
        UI[User Interface]
        Chat[Chat Component]
        Vis[Visualization Component]
    end

    subgraph Backend (Node.js + Express)
        API[API Endpoints]
        ImportAPI[Import API]
        ChatLogic[Chat Handling Logic]
        ExtractionQueue[Extraction Job Queue] --> ExtractionWorker
        LinkingQueue[Linking Job Queue] --> LinkingWorker
        QuestionGenTrigger[Question Generation Trigger] --> QuestionGenWorker
        PolicyGenTrigger[Policy Generation Trigger] --> PolicyGenWorker
        DB[MongoDB Database]
    end

    subgraph Background Workers
        ExtractionWorker[Problem/Solution Extractor (LLM)]
        LinkingWorker[Question Linker (LLM)]
        QuestionGenWorker[Sharp Question Generator (LLM)]
        PolicyGenWorker[Policy Draft Generator (LLM)]
    end

    subgraph External Services
        LLM_API[OpenRouter API (Gemini 2.0 Flash)]
    end

    UI -- User Input --> Chat
    Chat -- Send Message --> API
    API -- Process Chat --> ChatLogic
    ChatLogic -- Generate Response (via LLM_API) --> API
    ImportAPI -- Add Job --> ExtractionQueue
    ChatLogic -- Add Job --> ExtractionQueue
    API -- Send Response --> Chat

    ExtractionWorker -- Read Job --> ExtractionQueue
    ExtractionWorker -- Call LLM --> LLM_API
    ExtractionWorker -- Save Extracted Data --> DB
    ExtractionWorker -- Trigger Linking --> LinkingQueue

    QuestionGenTrigger -- Trigger Job --> QuestionGenWorker
    QuestionGenWorker -- Fetch Problems --> DB
    QuestionGenWorker -- Call LLM --> LLM_API
    QuestionGenWorker -- Save Questions --> DB
    QuestionGenWorker -- Trigger Linking --> LinkingQueue

    LinkingWorker -- Read Job --> LinkingQueue
    LinkingWorker -- Fetch Data --> DB
    LinkingWorker -- Call LLM --> LLM_API
    LinkingWorker -- Save Links --> DB

    PolicyGenTrigger -- Trigger Job --> PolicyGenWorker
    PolicyGenWorker -- Fetch Data & Links --> DB
    PolicyGenWorker -- Call LLM --> LLM_API
    PolicyGenWorker -- Save Draft --> DB

    Vis -- Request Data --> API
    API -- Fetch Visualisation Data --> DB
    API -- Send Data --> Vis

    UI -- Shows --> Vis
    UI -- Shows Thread Extractions --> API --> DB

    %% Connections between workers and DB implicitly exist for fetching/saving data
```

**3.1. フロントエンド (Vite + Tailwind)**

*   **UI/UX:**
    *   モバイルファースト、ミニマルで洗練されたデザイン。
    *   画面下部にフローティングするチャットコンポーネント。
    *   チャットコンポーネント内または付近に、現在のスレッドから抽出された課題/解決策をリアルタイム表示するエリア（控えめ）。
    *   画面上部（背景）に「シャープな問い」を中心とした可視化エリア。
        *   各「問い」を選択すると、関連する「課題」と「解決策」が関連度（relevanceScore）の高い順にソートされて表示される。
        *   各課題・解決策には関連度（relevanceScore）がパーセンテージで表示される。
        *   可視化方法例: カード形式、ノードグラフ、リスト表示などを組み合わせる。
*   **機能:**
    *   ユーザー認証（必要に応じて実装）。
    *   チャットメッセージの送受信。
    *   可視化データの取得と表示（API経由）。
    *   スレッド固有の抽出情報のリアルタイム更新（WebSocket or ポーリング）。
    *   （将来的に）政策ドラフトの表示、特定シャープな問いに対する政策生成トリガーボタン。

**3.2. バックエンド (Node.js + Express)**

*   **APIエンドポイント例:**
    *   `POST /api/chat/messages`: 新しいユーザーメッセージを受け取り、AI応答を返し、抽出プロセスを非同期で開始。
    *   `GET /api/chat/threads/:threadId/extractions`: 特定スレッドから抽出された課題/解決策を取得。
    *   `POST /api/import/generic`: 外部データ（ツイート等）を受け取り、DBに保存し、抽出プロセスを非同期で開始。
    *   `GET /api/questions`: シャープな問いの一覧を取得。
    *   `GET /api/questions/:questionId/details`: 特定の問いに関連する課題/解決策を取得（可視化用データ）。関連する課題と解決策は relevanceScore の降順（高い順）でソートされる。
    *   `POST /api/questions/:questionId/generate-policy`: 特定の問いに対する政策ドラフト生成を非同期で開始。
    *   `GET /api/policy-drafts`: 生成された政策ドラフト一覧を取得。
*   **主要ロジック:**
    *   **チャットハンドリング:**
        1.  ユーザーメッセージ受信 (`POST /api/chat/messages`)。
        2.  関連コンテキスト（会話履歴、DB内の既存課題/解決策サンプル、スレッド内抽出済み情報）を準備。
        3.  LLM (OpenRouter) にコンテキストと共に渡し、応答生成を依頼。
            *   プロンプトには、他者の意見紹介や深掘りを促す指示も含める。
        4.  LLMからの応答をユーザーに返す。
        5.  **非同期処理:** 抽出ジョブをキュー (ExtractionQueue) に追加（`sourceType: "chat"`, `sourceOriginId: threadId`, 新しいメッセージ内容を含む）。
    *   **外部データインポート:**
        1.  外部データ受信 (`POST /api/import/generic`)。リクエストボディには `sourceType`, `content`, `metadata` を含む。
        2.  データを `imported_items` コレクションに保存 (`status: "pending"`)。
        3.  **非同期処理:** 抽出ジョブをキュー (ExtractionQueue) に追加（`sourceType: importedItem.sourceType`, `sourceOriginId: importedItemId`, `content: importedItem.content`, `metadata: importedItem.metadata` を含む）。
    *   **課題/解決策 抽出プロセス (非同期ワーカー: ExtractionWorker):**
        1.  キューからジョブを取得 (`sourceType`, `sourceOriginId`, `content`, `metadata` 等を含む)。
        2.  `sourceType` に応じて必要なコンテキストを準備。
            *   `chat`: 対象スレッドの会話履歴、既存の抽出済み課題/解決策 (ID付き) をDBから取得。
            *   `tweet` / `other_import`: ジョブに含まれる `content` と `metadata` を使用。必要であれば `imported_items` レコードを参照。
        3.  LLMにコンテキストと共に渡し、「新しい課題/解決策の抽出」または「既存の課題/解決策の更新 (ID指定、チャットの場合)」を依頼。
            *   **プロンプト要件:**
                *   入力: 会話履歴、既存抽出物リスト (`[{id, type, statement...}]`)
                *   指示: 新規課題、新規解決策(手段)、既存課題/解決策の更新版(ID指定、チャットの場合)を抽出。単体で理解可能かつ文脈補足を徹底。感情的な表現は排除。ソースがチャットでない場合は、提供された単一のテキスト(`content`)から抽出するよう指示を調整。
                *   出力形式: JSONを要求。例:
                    ```json
                    {
                      "additions": [
                        { "type": "problem", "statement": "..." },
                        { "type": "solution", "statement": "..." }
                      ],
                      "updates": [
                        { "id": "problem_id_123", "type": "problem", "statement": "...", "version": 2 },
                        { "id": "solution_id_456", "type": "solution", "statement": "...", "version": 3 }
                      ]
                    }
                    ```
        4.  LLM応答(JSON)をパース。
        5.  DB (`problems`, `solutions`) に新規追加 or 更新。
            *   `sourceType` に応じて、`chat_threads` または `imported_items` の関連IDリストとステータスを更新。
        6.  **トリガー:** 新規追加/更新された課題/解決策のIDをリンキングキュー (LinkingQueue) に追加。
    *   **シャープな問い 生成プロセス (定期的 or トリガー式ワーカー: QuestionGenWorker):**
        1.  (例: 1日1回 or 新規課題が一定数蓄積したら) 起動。
        2.  DBから全ての（または最近の） `problems` の `combinedStatement` を取得。
        3.  LLMに課題リストを渡し、「How might we...?」形式のシャープな問いの生成を依頼。
            *   **プロンプト要件:**
                *   入力: 課題リスト (`combinedStatement` の配列)
                *   指示: Design ThinkingのHMWの精神（共通理解、行動指向）に基づき、課題群の根底にあるテーマを捉えた問いを生成。類似課題は一つの問いにまとめることを推奨。簡潔かつシャープに。
                *   出力形式: JSONを要求。例: `{ "questions": ["How might we ...?", "How might we ...?"] }`
        4.  LLM応答(JSON)をパース。
        5.  新しい問いを `sharp_questions` に保存。
        6.  **トリガー:** 生成された新しい問いのIDをリンキングキュー (LinkingQueue) に追加。
    *   **問いと課題/解決策のリンキングプロセス (非同期ワーカー: LinkingWorker):**
        1.  キューからジョブを取得（対象アイテムID: 課題/解決策 or 問い）。
        2.  **ケース1: 新しい課題/解決策が追加/更新された場合:**
            *   全ての `sharp_questions` を取得。
            *   各「問い」に対して、LLMに「この課題はこの問いを提起するか？」or「この解決策はこの問いに答えるか？」を判定させるリクエストを送信。
            *   **プロンプト要件:**
                *   入力: `sharp_questions.questionText`, `problems.combinedStatement` または `solutions.statement`
                *   指示: 問題提起(prompts_question)か、解決策提案(answers_question)かを判定。関連性があるか(boolean)、理由(rationale、任意)、関連度スコア(任意)を返す。
                *   出力形式: JSONを要求。例: `{ "is_relevant": true, "link_type": "prompts_question", "rationale": "この課題は問いの中心的な困難を示しているため。", "relevanceScore": 0.85 }`
            *   関連性があると判定された場合、`question_links` にレコードを作成/更新。
        3.  **ケース2: 新しいシャープな問いが追加された場合:**
            *   全ての `problems` と `solutions` を取得。
            *   各「課題」「解決策」に対して、LLMに上記と同様の判定リクエストを送信。
            *   関連性があると判定された場合、`question_links` にレコードを作成。
        *   **実装注意点:** LLMへのリクエストが多くなる可能性があるため、バッチ処理やレート制限を考慮。MongoDB Change Streams を使ってDBの変更を検知し、このワーカーをトリガーする方式も有効。
    *   **政策ドラフト生成プロセス (オンデマンドワーカー: PolicyGenWorker):**
        1.  API経由でトリガー (`POST /api/questions/:questionId/generate-policy`)。キュー経由でワーカーに渡す。
        2.  指定された `questionId` に紐づく `sharp_questions` と、`question_links` を介して関連する全ての `problems` (`combinedStatement`) と `solutions` (`statement`) をDBから取得。
        3.  LLMに問い、課題リスト、解決策リストを渡し、政策ドラフトの生成を依頼。
            *   **プロンプト要件:**
                *   入力: `questionText`, `problemStatements` (配列), `solutionStatements` (配列)
                *   指示: これらを参考に、現実的で具体的な政策提言を作成。課題を明確にし、解決策を構造化。全ての入力要素を拾う必要はなく、良い政策提言作成を優先。不足情報は適切に補完して良い。タイトルと本文を生成。
                *   出力形式: JSONを要求。例: `{ "title": "...", "content": "..." }`
        4.  LLM応答(JSON)をパース。
        5.  結果を `policy_drafts` に保存。

**3.3. LLM連携 (OpenRouter - Gemini 2.0 Flash)**

*   専用モジュール(`llm_service.js`等)を作成し、LLM APIコールを抽象化。
*   `.env` ファイルでAPIキーを管理 (`OPENROUTER_API_KEY`)。
    ```javascript
    import OpenAI from 'openai';
    import dotenv from 'dotenv';

    dotenv.config();

    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    async function callLLM(messages, jsonOutput = false) {
      const options = {
        model: 'google/gemini-2.0-flash-001',
        messages: messages,
      };
      if (jsonOutput) {
        options.response_format = { type: 'json_object' };
        // Ensure the last message prompts for JSON output explicitly
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
           messages[messages.length - 1].content += "\n\nPlease respond ONLY in JSON format.";
        }
      }

      try {
        const completion = await openai.chat.completions.create(options);
        const content = completion.choices[0].message?.content;
        if (jsonOutput && content) {
          try {
            return JSON.parse(content);
          } catch (e) {
            console.error("Failed to parse LLM JSON response:", content, e);
            throw new Error("LLM did not return valid JSON.");
          }
        }
        return content;
      } catch (error) {
        console.error('Error calling OpenRouter:', error);
        // Implement retry logic if needed
        throw error;
      }
    }

    export { callLLM };
    ```
*   各LLM利用箇所で上記`callLLM`関数を使用し、必要に応じて`jsonOutput=true`を指定。プロンプト内でJSON形式を明示することも重要。

**3.4. 非同期処理の実現**

*   Node.js環境では `bullmq` (Redisベース) や `agenda` (MongoDBベース) などのジョブキューライブラリを使用するか、シンプルな用途であればインメモリキュー（ただし永続性はない）や、MongoDB Change Streams を利用してDB変更をトリガーにする方法があります。Change Streamsは `question_links` の更新検知に適しています。

## 4. 技術スタックまとめ

*   **フロントエンド:** Vite, React/Vue/Svelte, Tailwind CSS
*   **バックエンド:** Node.js, Express
*   **データベース:** MongoDB (Mongoose ODMを利用推奨)
*   **LLM:** OpenRouter (Google Gemini 2.0 Flash)
*   **非同期処理:** BullMQ, Agenda, or MongoDB Change Streams
*   **環境変数管理:** dotenv

## 5. 考慮事項
*   **プロンプトエンジニアリング:** 各LLM呼び出しの精度はプロンプトに大きく依存するため、継続的な改善が必要。特にJSON形式での安定した出力には工夫が要る。
*   **エラーハンドリング:** LLM APIエラー、DBエラー、非同期処理の失敗などを考慮した堅牢なエラーハンドリングとリトライ機構を実装する。
*   **データ更新の競合:** 同じ課題/解決策が短時間に更新されるケースを考慮し、バージョン管理 (`version` フィールド) やアトミックな更新操作を利用する。
*   **セキュリティ:** APIキーの安全な管理、必要に応じた入力サニタイズ。
*   **UI/UX:** 可視化部分のデザインが重要。情報量が多くなりがちなので、直感的で分かりやすい表示方法を工夫する。

これで、提案されたシステムの詳細設計とデータ構造が定義されました。これを基に各コンポーネントの実装を進めることができるはずです。