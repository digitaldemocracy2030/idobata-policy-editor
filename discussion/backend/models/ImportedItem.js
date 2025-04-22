import mongoose from 'mongoose';

const ImportedItemSchema = new mongoose.Schema({
  sourceType: {
    type: String,
    required: true,
    // Removed enum constraint to allow any string value
    index: true,
  },
  content: {
    type: String,
    required: true,
  },
  metadata: {
    type: Object, // Flexible structure for various metadata (e.g., tweetId, author, url, timestamp)
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  extractedProblemIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
  }],
  extractedSolutionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Solution',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: {
    type: Date,
  },
  errorMessage: {
    type: String,
  },
});

export default mongoose.model('ImportedItem', ImportedItemSchema);