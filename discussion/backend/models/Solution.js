import mongoose from 'mongoose';

const solutionSchema = new mongoose.Schema({
    statement: { // 解決策の具体的な手段
        type: String,
        required: true,
    },
    sourceOriginId: { // 抽出元の `chat_threads` ID または `imported_items` ID
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        // We can't use a simple ref here as it could be ChatThread or ImportedItem.
        // We'll rely on sourceType to know which collection to query.
    },
    sourceType: { // データソース種別
        type: String,
        required: true,
        // Removed enum constraint to allow any string value
    },
    originalSnippets: { // (任意) 抽出の元になったユーザー発言の断片
        type: [String],
        default: [],
    },
    sourceMetadata: { // (任意) ソースに関する追加情報 (例: tweet ID, URL, author)
        type: Object,
        default: {},
    },
    version: { // 更新版管理用バージョン番号
        type: Number,
        required: true,
        default: 1,
    },
}, { timestamps: true }); // createdAt, updatedAt を自動追加

const Solution = mongoose.model('Solution', solutionSchema);

export default Solution;