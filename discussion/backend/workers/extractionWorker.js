import mongoose from 'mongoose';
import ChatThread from '../models/ChatThread.js'; // For chat source
import ImportedItem from '../models/ImportedItem.js'; // For import source
import Problem from '../models/Problem.js';
import Solution from '../models/Solution.js';
import { callLLM } from '../services/llmService.js';
import { linkItemToQuestions } from './linkingWorker.js'; // Assume this function exists and works

// Helper function to build the prompt based on source type
function buildExtractionPrompt(sourceType, data) {
    let prompt = '';

    if (sourceType === 'chat') {
        const { messages, existingProblems, existingSolutions } = data;
        // Prepare conversation history string
        // Find the latest user message index
        const latestUserIndex = [...messages].reverse().findIndex(msg => msg.role === 'user');
        const latestUserPosition = latestUserIndex >= 0 ? messages.length - 1 - latestUserIndex : -1;

        // Get the latest user message content
        const latestUserMessage = latestUserPosition >= 0 ? messages[latestUserPosition].content : 'No user message found';

        // Format messages with special marking for the latest user message
        const history = messages.map((msg, index) => {
            const isLatestUser = index === latestUserPosition;
            return `${msg.role}${isLatestUser ? ' [LATEST USER MESSAGE]' : ''}: ${msg.content}`;
        }).join('\n');

        // Prepare existing data summaries
        const existingProblemSummary = existingProblems.length > 0
            ? existingProblems.map(p => `- ID: ${p._id}, Statement: ${p.statement}`).join('\n')
            : 'None';
        const existingSolutionSummary = existingSolutions.length > 0
            ? existingSolutions.map(s => `- ID: ${s._id}, Statement: ${s.statement}`).join('\n')
            : 'None';

        // Construct the prompt for chat
        prompt = `
Conversation History:
---
${history}
---

Existing Extracted Problems (for context, focus on user turns below for *new* problems):
---
${existingProblemSummary}
---

Existing Extracted Solutions (for context, focus on user turns below for *new* solutions):
---
${existingSolutionSummary}
---

Latest User Message:
---
${latestUserMessage}
---

Instructions:
Analyze the **latest user message** (marked with [LATEST USER MESSAGE]) in the Conversation History above.
Identify and extract the following, ensuring the output is in **Japanese**:
1.  **New Problems:** If a user message introduces a new problem (an unmet need or challenge), describe it. Provide:
    *   statement (A concise description of the problem, Japanese)
2.  **New Solutions:** If a user message proposes a specific solution or approach, describe it. Provide:
    *   statement (The core solution, Japanese)
3.  **Updates to Existing Items:** If a user message refines or clarifies an *existing* problem or solution (listed above), provide its ID and the updated Japanese statement.

Guidelines for Effective Problem Statements:
- 二文構成で記述する：
  * 一文目：主語を明確にし、「何を」「なぜ」という構造で課題を定義する
  * 二文目：チャットの文脈や背景情報を補足する
  * 良い例：「高齢者は、デジタル機器の操作が複雑で理解しづらいため、行政サービスのオンライン化に対応できていない。この問題はユーザーが行政手続きのオンライン化について質問した際に、高齢の親族がシステムを使えずに困っているという具体的な事例を挙げながら説明された課題である。」
  * 悪い例：「デジタル化への対応が難しい」（主語が不明確で背景情報がない）
- 現状と理想の状態を明確に記述し、そのギャップを問題として定義する
  * 良い例：「現在、地域住民は災害情報を入手するのに複数のメディアを確認する必要があるが、理想的には単一の信頼できる情報源から迅速に情報を得られるべきである。この課題は防災アプリの改善について議論している会話の中で、ユーザーが前回の台風時に情報が分散していて混乱したという具体的な経験を共有した際に浮かび上がった。」
  * 悪い例：「災害情報が不足している」（現状と理想のギャップが不明確で背景情報がない）
- 具体的な状況と影響を記述し、問題の本質を捉えやすくする
  * 良い例：「子育て世帯の親は、保育施設の空き状況を確認するために複数の施設に個別に問い合わせる必要があり、就労と育児の両立に大きな時間的負担となっている。この問題は子育て支援サービスについての会話で、ユーザーが先週5つの保育園に個別に電話をかけて空き状況を確認するのに半日かかったという具体的な体験を述べた際に明らかになった。」
  * 悪い例：「保育施設の情報収集が大変」（具体的な影響が不明確で背景情報がない）
- 解決策の先走りや抽象的な表現を避ける
- 感情的な表現や主観的な解釈を排し、客観的な事実に基づいて記述する
- 問題の範囲を明確にし、多様な視点からの議論を促す表現を心がける

Guidelines for Effective Solution Statements:
- 二文構成で記述する：
  * 一文目：具体的な行動、機能、そしてそれがもたらす価値を明確に記述する
  * 二文目：チャットの文脈や背景情報を補足する
  * 良い例：「高齢者向けに、音声操作機能を搭載した行政サービスアプリを開発することで、デジタル機器の操作が苦手な高齢者でも容易に行政サービスにアクセスできるようになる。この提案は行政サービスのアクセシビリティについて議論していた会話の中で、ユーザーが祖父母がタッチスクリーンの操作に苦労している具体的な状況を説明した後に出された解決策である。」
  * 悪い例：「アプリを改善する」（具体的な行動と価値が不明確で背景情報がない）
- 実現可能性や費用対効果といった制約条件も考慮する
  * 良い例：「既存の防災システムに、地域ごとにカスタマイズ可能なアラート機能を追加することで、低コストで効果的な情報伝達が実現できる。この解決策は災害情報の伝達方法について話し合っていた際に、ユーザーが自治体の限られた予算内で実現可能な方法として具体的に提案したものである。」
  * 悪い例：「最新技術を使った防災システムを構築する」（実現可能性や費用対効果が考慮されていない）
- 曖昧な表現や抽象的な概念を避ける
  * 良い例：「保育施設の空き状況をリアルタイムで確認できるウェブポータルを構築し、検索条件に合わせた施設リストを表示する機能を実装する。この機能は子育て支援アプリの機能について議論していた会話で、ユーザーが実際に経験した保育園探しの苦労を具体的に説明した後に提案されたものである。」
  * 悪い例：「保育施設の情報を改善する」（何をどう改善するか不明確で背景情報がない）
- 課題に対する具体的な応答として解決策を提示する
- 効果、リスク、実装に必要なステップを明確にする

Rules:
- Focus *only* on the contributions from the 'user' role marked with [LATEST USER MESSAGE] in the conversation history for identifying *new* problems or solutions.
- The message marked with [LATEST USER MESSAGE] is the most recent user message that you should analyze.
- Ensure all generated statements are in **Japanese**.
- If no new problems/solutions or updates are found, return empty arrays.
- Refer to existing items by their provided IDs when suggesting updates.
- **重要**: 情報が不足している場合は、無理に問題や解決策を生成しないでください。良質なstatementを作成するための十分な情報がない場合は、空の配列を返してください。不確かな推測や曖昧な表現は避け、明確に表現できる場合のみ抽出してください。

Output Format: Respond ONLY in JSON format with the following structure:
{
  "additions": [
    { "type": "problem", "statement": "課題の説明..." },
    { "type": "solution", "statement": "具体的な解決策..." }
  ],
  "updates": [
    { "id": "existing_problem_id", "type": "problem", "statement": "更新された課題の説明..." },
    { "id": "existing_solution_id", "type": "solution", "statement": "更新された解決策..." }
  ]
}
`;
    } else if (sourceType === 'tweet' || sourceType === 'other_import' || sourceType !== 'chat') {
        const { content } = data;
        // Construct the prompt for single text import
        prompt = `
Input Text:
---
${content}
---

Instructions:
Analyze the Input Text above.
Identify and extract the following, ensuring the output is in **Japanese**:
1.  **Problems:** If the text describes a problem (an unmet need or challenge), describe it. Provide:
    *   statement (A concise description of the problem, Japanese)
2.  **Solutions:** If the text proposes a specific solution or approach, describe it. Provide:
    *   statement (The core solution, Japanese)

Guidelines for Effective Problem Statements:
- 二文構成で記述する：
  * 一文目：主語を明確にし、「何を」「なぜ」という構造で課題を定義する
  * 二文目：コメントの文脈や背景情報を補足する
  * 良い例：「高齢者は、デジタル機器の操作が複雑で理解しづらいため、行政サービスのオンライン化に対応できていない。この問題は高齢者向けデジタル支援講座の参加者が実際に経験した具体的な困難事例（マイナンバーカード申請時のオンラインフォーム入力での混乱など）を記録したSNS投稿から抽出された課題である。」
  * 悪い例：「デジタル化への対応が難しい」（主語が不明確で背景情報がない）
- 現状と理想の状態を明確に記述し、そのギャップを問題として定義する
  * 良い例：「現在、地域住民は災害情報を入手するのに複数のメディアを確認する必要があるが、理想的には単一の信頼できる情報源から迅速に情報を得られるべきである。この課題は昨年の台風被害後に開催された市民フォーラムで、被災者が情報収集に苦労した具体的な事例（停電時にラジオ、SNS、行政放送を同時に確認する必要があった状況など）を共有した投稿から抽出された。」
  * 悪い例：「災害情報が不足している」（現状と理想のギャップが不明確で背景情報がない）
- 具体的な状況と影響を記述し、問題の本質を捉えやすくする
  * 良い例：「子育て世帯の親は、保育施設の空き状況を確認するために複数の施設に個別に問い合わせる必要があり、就労と育児の両立に大きな時間的負担となっている。この問題は地域の子育て支援フォーラムで、共働き世帯の親が保育園探しのために休暇を取らざるを得なかった具体的な事例や、電話での問い合わせが営業時間内に限られるため仕事中に対応できないといった実体験が共有された投稿から抽出された。」
  * 悪い例：「保育施設の情報収集が大変」（具体的な影響が不明確で背景情報がない）
- 解決策の先走りや抽象的な表現を避ける
- 感情的な表現や主観的な解釈を排し、客観的な事実に基づいて記述する
- 問題の範囲を明確にし、多様な視点からの議論を促す表現を心がける

Guidelines for Effective Solution Statements:
- 二文構成で記述する：
  * 一文目：具体的な行動、機能、そしてそれがもたらす価値を明確に記述する
  * 二文目：コメントの文脈や背景情報を補足する
  * 良い例：「高齢者向けに、音声操作機能を搭載した行政サービスアプリを開発することで、デジタル機器の操作が苦手な高齢者でも容易に行政サービスにアクセスできるようになる。この提案はIT専門家が具体的な解決策として提案した内容から抽出された。」
  * 悪い例：「アプリを改善する」（具体的な行動と価値が不明確で背景情報がない）
- 実現可能性や費用対効果といった制約条件も考慮する
  * 良い例：「既存の防災システムに、地域ごとにカスタマイズ可能なアラート機能を追加することで、低コストで効果的な情報伝達が実現できる。この解決策は市の防災担当者が予算削減の状況下で効率的な防災情報伝達手段を模索していた際に、実際の災害対応経験に基づいて提案した内容から抽出された。」
  * 悪い例：「最新技術を使った防災システムを構築する」（実現可能性や費用対効果が考慮されていない）
- 曖昧な表現や抽象的な概念を避ける
  * 良い例：「保育施設の空き状況をリアルタイムで確認できるウェブポータルを構築し、検索条件に合わせた施設リストを表示する機能を実装する。この機能は地域の子育て支援フォーラムで、複数の親が実際に保育園探しで経験した具体的な困難（営業時間内の電話確認の難しさ、複数施設への問い合わせの手間など）を詳細に記述した投稿から抽出された解決策である。」
  * 悪い例：「保育施設の情報を改善する」（何をどう改善するか不明確で背景情報がない）
- 課題に対する具体的な応答として解決策を提示する
- 効果、リスク、実装に必要なステップを明確にする

Rules:
- Extract only problems and solutions explicitly mentioned or strongly implied in the text.
- Ensure all generated statements are in **Japanese**.
- If no problems or solutions are found, return an empty array for "additions".
- **重要**: 情報が不足している場合は、無理に問題や解決策を生成しないでください。良質なstatementを作成するための十分な情報がない場合は、空の配列を返してください。不確かな推測や曖昧な表現は避け、明確に表現できる場合のみ抽出してください。

Output Format: Respond ONLY in JSON format with the following structure:
{
  "additions": [
    { "type": "problem", "statement": "課題の説明...(課題とコメントの背景の二文構成で記述する)" },
    { "type": "solution", "statement": "具体的な解決策...(解決策とコメントの背景の二文構成で記述する)" }
  ]
}
`;
    }

    // Return messages array for LLM
    return [{ role: 'user', content: prompt }];
}

// Helper to save a new problem/solution and trigger linking
async function saveAndLinkItem(itemData, sourceOriginId, sourceType, sourceMetadata) {
    let savedItem;
    if (itemData.type === 'problem') {
        const newProblem = new Problem({
            statement: itemData.statement,
            sourceOriginId: sourceOriginId,
            sourceType: sourceType,
            sourceMetadata: sourceMetadata || {},
            version: 1,
        });
        savedItem = await newProblem.save();
        console.log(`[ExtractionWorker] Added Problem: ${savedItem._id} from ${sourceType} ${sourceOriginId}`);
    } else if (itemData.type === 'solution') {
        const newSolution = new Solution({
            statement: itemData.statement,
            sourceOriginId: sourceOriginId,
            sourceType: sourceType,
            sourceMetadata: sourceMetadata || {},
            version: 1,
        });
        savedItem = await newSolution.save();
        console.log(`[ExtractionWorker] Added Solution: ${savedItem._id} from ${sourceType} ${sourceOriginId}`);
    }

    if (savedItem) {
        // Trigger linking asynchronously
        setTimeout(() => linkItemToQuestions(savedItem._id.toString(), itemData.type), 0);
        return savedItem;
    }
    return null;
}

// Main processing function called by the job queue worker
async function processExtraction(job) {
    const { sourceType, sourceOriginId, content, metadata } = job.data; // Assuming job data structure
    console.log(`[ExtractionWorker] Starting extraction for ${sourceType}: ${sourceOriginId}`);
    // Transaction removed as it requires a replica set/mongos

    try {
        let llmResponse;
        const addedProblemIds = [];
        const addedSolutionIds = [];

        if (sourceType === 'chat') {
            // --- Chat Processing Logic ---
            const thread = await ChatThread.findById(sourceOriginId);
            if (!thread) {
                console.error(`[ExtractionWorker] ChatThread not found: ${sourceOriginId}`);
                return; // Or throw error for queue retry
            }

            const existingProblemIds = thread.extractedProblemIds || [];
            const existingSolutionIds = thread.extractedSolutionIds || [];

            const [existingProblems, existingSolutions] = await Promise.all([
                Problem.find({ '_id': { $in: existingProblemIds } }),
                Solution.find({ '_id': { $in: existingSolutionIds } })
            ]);

            // 2. Build prompt and call LLM for chat
            const extractionPromptMessages = buildExtractionPrompt('chat', { messages: thread.messages, existingProblems, existingSolutions });
            llmResponse = await callLLM(extractionPromptMessages, true); // Request JSON

            if (!llmResponse || typeof llmResponse !== 'object' || (!llmResponse.additions && !llmResponse.updates)) {
                console.warn(`[ExtractionWorker] LLM did not return valid JSON or expected structure for chat ${sourceOriginId}. Response:`, llmResponse);
                return; // Or throw error
            }

            const additions = llmResponse.additions || [];
            const updates = llmResponse.updates || [];

            // 3. Process additions for chat
            const totalAdditions = additions.length;
            console.log(`[ExtractionWorker] Processing ${totalAdditions} new items for chat ${sourceOriginId}`);

            for (let i = 0; i < additions.length; i++) {
                const item = additions[i];
                console.log(`[ExtractionWorker] Processing item ${i + 1}/${totalAdditions} (${item.type}) for chat ${sourceOriginId}`);
                const savedItem = await saveAndLinkItem(item, sourceOriginId, 'chat', {}); // No specific metadata for chat items
                if (savedItem) {
                    if (item.type === 'problem') addedProblemIds.push(savedItem._id);
                    if (item.type === 'solution') addedSolutionIds.push(savedItem._id);
                }
            }

            // 4. Process updates for chat (existing logic adapted)
            const totalUpdates = updates.length;
            console.log(`[ExtractionWorker] Processing ${totalUpdates} updates for chat ${sourceOriginId}`);

            for (let i = 0; i < updates.length; i++) {
                const item = updates[i];
                console.log(`[ExtractionWorker] Processing update ${i + 1}/${totalUpdates} (${item.type}) for chat ${sourceOriginId}`);
                if (!item.id) {
                    console.warn(`[ExtractionWorker] Invalid update item received from LLM for chat ${sourceOriginId}:`, item);
                    continue;
                }
                const updateData = { ...item };
                delete updateData.id;
                delete updateData.type;
                delete updateData.version; // Let $inc handle version

                let Model, existingItem;
                if (item.type === 'problem') Model = Problem;
                else if (item.type === 'solution') Model = Solution;
                else continue;

                existingItem = await Model.findById(item.id);
                if (!existingItem) {
                    console.warn(`[ExtractionWorker] ${item.type} ${item.id} not found for update (chat ${sourceOriginId}).`);
                    continue;
                }

                const result = await Model.findOneAndUpdate(
                    { _id: item.id, version: existingItem.version },
                    { $set: updateData, $inc: { version: 1 } },
                    { new: true }
                );
                if (result) {
                    console.log(`[ExtractionWorker] Updated ${item.type}: ${item.id} to version ${result.version} (chat ${sourceOriginId})`);
                    setTimeout(() => linkItemToQuestions(item.id.toString(), item.type), 0); // Trigger linking for updates too
                } else {
                    console.warn(`[ExtractionWorker] Failed to update ${item.type} ${item.id} (chat ${sourceOriginId}). Version mismatch or not found.`);
                }
            }

            // 5. Update ChatThread with new IDs (if any)
            if (addedProblemIds.length > 0 || addedSolutionIds.length > 0) {
                await ChatThread.updateOne(
                    { _id: sourceOriginId },
                    {
                        $addToSet: {
                            extractedProblemIds: { $each: addedProblemIds },
                            extractedSolutionIds: { $each: addedSolutionIds },
                        },
                    }
                );
                console.log(`[ExtractionWorker] Updated chat thread ${sourceOriginId} with new extraction IDs.`);
            }

        } else if (sourceType === 'tweet' || sourceType === 'other_import' || sourceType !== 'chat') {
            // --- Import Processing Logic ---
            const importItem = await ImportedItem.findById(sourceOriginId);
            if (!importItem) {
                console.error(`[ExtractionWorker] ImportedItem not found: ${sourceOriginId}`);
                return; // Or throw error
            }
            if (importItem.status !== 'pending') {
                console.warn(`[ExtractionWorker] ImportedItem ${sourceOriginId} is not pending, skipping. Status: ${importItem.status}`);
                return;
            }

            // Mark as processing
            importItem.status = 'processing';
            await importItem.save();

            // 2. Build prompt and call LLM for import
            const extractionPromptMessages = buildExtractionPrompt(sourceType, { content: importItem.content });
            llmResponse = await callLLM(extractionPromptMessages, true); // Request JSON

            if (!llmResponse || typeof llmResponse !== 'object' || !llmResponse.additions) {
                console.warn(`[ExtractionWorker] LLM did not return valid JSON or expected structure for import ${sourceOriginId}. Response:`, llmResponse);
                importItem.status = 'failed';
                importItem.errorMessage = 'LLM response invalid';
                await importItem.save();
                return; // Or throw error
            }

            const additions = llmResponse.additions || [];

            // 3. Process additions for import
            const totalAdditions = additions.length;
            console.log(`[ExtractionWorker] Processing ${totalAdditions} new items for ${sourceType} ${sourceOriginId}`);

            for (let i = 0; i < additions.length; i++) {
                const item = additions[i];
                console.log(`[ExtractionWorker] Processing item ${i + 1}/${totalAdditions} (${item.type}) for ${sourceType} ${sourceOriginId}`);
                // Use the metadata from the job/importItem
                const savedItem = await saveAndLinkItem(item, sourceOriginId, sourceType, importItem.metadata);
                if (savedItem) {
                    if (item.type === 'problem') addedProblemIds.push(savedItem._id);
                    if (item.type === 'solution') addedSolutionIds.push(savedItem._id);
                }
            }

            // 4. Update ImportedItem status and IDs
            importItem.status = 'completed';
            importItem.extractedProblemIds = addedProblemIds;
            importItem.extractedSolutionIds = addedSolutionIds;
            importItem.processedAt = new Date();
            importItem.errorMessage = undefined; // Clear previous error if any
            await importItem.save();
            console.log(`[ExtractionWorker] Updated imported item ${sourceOriginId} with status 'completed' and extraction IDs.`);

        }

        // Common success log
        console.log(`[ExtractionWorker] Successfully processed extraction for ${sourceType}: ${sourceOriginId}`);

    } catch (error) {
        console.error(`[ExtractionWorker] Error processing extraction for ${sourceType} ${sourceOriginId}:`, error);

        // Attempt to mark ImportedItem as failed if applicable
        if (sourceType === 'tweet' || sourceType === 'other_import' || sourceType !== 'chat') {
            try {
                await ImportedItem.updateOne(
                    { _id: sourceOriginId, status: 'processing' }, // Only update if still processing
                    { $set: { status: 'failed', errorMessage: error.message || 'Unknown error' } }
                );
            } catch (updateError) {
                console.error(`[ExtractionWorker] Failed to mark ImportedItem ${sourceOriginId} as failed:`, updateError);
            }
        }
        // Rethrow the error if the job queue supports retries
        // throw error;
    }
}

// Export the main processing function
export { processExtraction };

/*
// --- Old Chat-Specific Logic (kept for reference during refactoring, remove later) ---

async function processExtraction_OLD(threadId) {
    console.log(`[ExtractionWorker] Starting extraction for thread: ${threadId}`);
    // Transaction removed as it requires a replica set/mongos

    try {
        // 1. Fetch thread and existing extractions within the transaction
        const thread = await ChatThread.findById(threadId); // Removed .session(session)
        if (!thread) {
            console.error(`[ExtractionWorker] Thread not found: ${threadId}`);
            // Removed transaction abort/end
            return;
        }

        const existingProblemIds = thread.extractedProblemIds || [];
        const existingSolutionIds = thread.extractedSolutionIds || [];

        const [existingProblems, existingSolutions] = await Promise.all([
            Problem.find({ '_id': { $in: existingProblemIds } }), // Removed .session(session)
            Solution.find({ '_id': { $in: existingSolutionIds } }) // Removed .session(session)
        ]);

        // 2. Build prompt and call LLM
        const extractionPromptMessages = buildExtractionPrompt_OLD(thread.messages, existingProblems, existingSolutions);
        const llmResponse = await callLLM(extractionPromptMessages, true); // Request JSON output

        if (!llmResponse || typeof llmResponse !== 'object' || (!llmResponse.additions && !llmResponse.updates)) {
            console.warn(`[ExtractionWorker] LLM did not return valid JSON or expected structure for thread ${threadId}. Response:`, llmResponse);
            // Removed transaction abort/end
            return;
        }


        const additions = llmResponse.additions || [];
        const updates = llmResponse.updates || [];
        const addedProblemIds = [];
        const addedSolutionIds = [];

        // 3. Process additions
        for (const item of additions) {
             const savedItem = await saveAndLinkItem(item, threadId, 'chat', {}); // Use helper
             if (savedItem) {
                 if (item.type === 'problem') addedProblemIds.push(savedItem._id);
                 if (item.type === 'solution') addedSolutionIds.push(savedItem._id);
             }
        }

        // 4. Process updates
         for (const item of updates) {
             if (!item.id) {
                console.warn(`[ExtractionWorker] Invalid update item received from LLM for thread ${threadId}:`, item);
                continue;
            }
            const updateData = { ...item };
            delete updateData.id;
            delete updateData.type;
            delete updateData.version; // Let $inc handle version

            let Model, existingItem;
            if (item.type === 'problem') Model = Problem;
            else if (item.type === 'solution') Model = Solution;
            else continue;

            existingItem = await Model.findById(item.id);
            if (!existingItem) {
                 console.warn(`[ExtractionWorker] ${item.type} ${item.id} not found for update (thread ${threadId}).`);
                 continue;
            }

            const result = await Model.findOneAndUpdate(
                { _id: item.id, version: existingItem.version },
                { $set: updateData, $inc: { version: 1 } },
                { new: true }
            );
            if (result) {
                console.log(`[ExtractionWorker] Updated ${item.type}: ${item.id} to version ${result.version} (thread ${threadId})`);
                setTimeout(() => linkItemToQuestions(item.id.toString(), item.type), 0); // Trigger linking for updates too
            } else {
                console.warn(`[ExtractionWorker] Failed to update ${item.type} ${item.id} (thread ${threadId}). Version mismatch or not found.`);
            }
        }

        // 5. Update ChatThread with new IDs (if any)
        if (addedProblemIds.length > 0 || addedSolutionIds.length > 0) {
            await ChatThread.updateOne(
                { _id: threadId },
                {
                    $addToSet: {
                        extractedProblemIds: { $each: addedProblemIds },
                        extractedSolutionIds: { $each: addedSolutionIds },
                    },
                }
            );
            console.log(`[ExtractionWorker] Updated thread ${threadId} with new extraction IDs.`);
        }

        // Transaction removed
        console.log(`[ExtractionWorker] Successfully processed extraction for thread: ${threadId}`);

    } catch (error) {
        console.error(`[ExtractionWorker] Error processing extraction for thread ${threadId}:`, error);
        // Transaction removed
        // Consider adding retry logic or moving to a dead-letter queue here
    }
    // Linking is triggered within the loop now
}
*/
