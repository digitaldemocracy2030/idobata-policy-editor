import mongoose from 'mongoose';

const policyDraftSchema = new mongoose.Schema({
    questionId: { // 対象とする `sharp_questions` のID
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SharpQuestion',
        required: true,
    },
    title: { // 政策ドラフトのタイトル
        type: String,
        required: true,
    },
    content: { // 政策ドラフトの本文
        type: String,
        required: true,
    },
    sourceProblemIds: [{ // 参考にした `problems` のIDリスト
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem',
    }],
    sourceSolutionIds: [{ // 参考にした `solutions` のIDリスト
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Solution',
    }],
    version: { // バージョン番号
        type: Number,
        required: true,
        default: 1,
    },
}, { timestamps: true }); // createdAt, updatedAt を自動追加 (todo.md指示)

const PolicyDraft = mongoose.model('PolicyDraft', policyDraftSchema);

export default PolicyDraft;