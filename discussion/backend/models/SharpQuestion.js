import mongoose from 'mongoose';

const sharpQuestionSchema = new mongoose.Schema({
    questionText: { // "How might we..." 形式の問い
        type: String,
        required: true,
    },
    sourceProblemIds: [{ // (任意) この問いの生成に使用された `problems` のIDリスト
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem',
    }],
}, { timestamps: true }); // createdAt, updatedAt を自動追加 (todo.md指示)

const SharpQuestion = mongoose.model('SharpQuestion', sharpQuestionSchema);

export default SharpQuestion;