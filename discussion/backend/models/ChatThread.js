import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
}, { _id: false }); // Don't create separate _id for subdocuments

const chatThreadSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true, // Index userId for faster lookups
    },
    messages: [messageSchema],
    extractedProblemIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem', // Reference to the Problem model
    }],
    extractedSolutionIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Solution', // Reference to the Solution model
    }],
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

const ChatThread = mongoose.model('ChatThread', chatThreadSchema);

export default ChatThread;