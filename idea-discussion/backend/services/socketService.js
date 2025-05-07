import mongoose from "mongoose";
import { io } from "../server.js";

/**
 * Emit a new extraction event to all clients subscribed to a theme or thread
 * @param {string} themeId - The theme ID
 * @param {string} threadId - The thread ID (optional)
 * @param {string} type - The type of extraction ("problem" or "solution")
 * @param {Object} data - The extraction data
 */
export function emitNewExtraction(themeId, threadId, type, data) {
  console.log(
    `[SocketService] Emitting new-extraction event for theme:${themeId}`,
  );

  const event = {
    type,
    data,
  };

  io.to(`theme:${themeId}`).emit("new-extraction", event);

  if (threadId) {
    console.log(
      `[SocketService] Emitting new-extraction event for thread:${threadId}`,
    );
    io.to(`thread:${threadId}`).emit("new-extraction", event);
  }
}

/**
 * Emit an extraction update event to all clients subscribed to a theme or thread
 * @param {string} themeId - The theme ID
 * @param {string} threadId - The thread ID (optional)
 * @param {string} type - The type of extraction ("problem" or "solution")
 * @param {Object} data - The extraction data
 */
export function emitExtractionUpdate(themeId, threadId, type, data) {
  console.log(
    `[SocketService] Emitting extraction-update event for theme:${themeId}`,
  );

  const event = {
    type,
    data,
  };

  io.to(`theme:${themeId}`).emit("extraction-update", event);

  if (threadId) {
    console.log(
      `[SocketService] Emitting extraction-update event for thread:${threadId}`,
    );
    io.to(`thread:${threadId}`).emit("extraction-update", event);
  }
}
/**
 * Emit a chat response sentence to clients subscribed to a thread
 * @param {string} themeId - The theme ID
 * @param {string} threadId - The thread ID
 * @param {string} sentence - The sentence to emit
 */
export function emitChatResponseSentence(themeId, threadId, sentence) {
  console.log(
    `[SocketService] Emitting chat-response-sentence event for thread:${threadId}`,
  );

  const event = {
    sentence,
    timestamp: new Date(),
  };

  if (threadId) {
    io.to(`thread:${threadId}`).emit("chat-response-sentence", event);
  }
}

/**
 * Clear pending sentences for a thread
 * @param {string} threadId - The thread ID
 */
export function clearPendingSentences(threadId) {
  console.log(
    `[SocketService] Clearing pending sentences for thread:${threadId}`,
  );

  if (threadId) {
    io.to(`thread:${threadId}`).emit("chat-response-clear", {
      timestamp: new Date(),
    });
  }
}

/**
 * Stream chat response sentences with a delay
 * @param {string} themeId - The theme ID
 * @param {string} threadId - The thread ID
 * @param {Array<string>} sentences - The sentences to emit
 * @param {number} startIndex - The index to start from (default: 1, skipping the first sentence)
 */
export async function streamChatResponse(
  themeId,
  threadId,
  sentences,
  startIndex = 1,
) {
  if (sentences.length <= startIndex) {
    return;
  }

  const ChatThread = mongoose.model("ChatThread");

  for (let i = startIndex; i < sentences.length; i++) {
    const thread = await ChatThread.findById(threadId);
    if (!thread || thread.pendingSentences.length === 0) {
      console.log(
        `[SocketService] Stopping stream for thread:${threadId} - no pending sentences`,
      );
      return;
    }

    const sentence = sentences[i];
    const delay = sentence.length * 200; // Convert to milliseconds

    await new Promise((resolve) => setTimeout(resolve, delay));

    emitChatResponseSentence(themeId, threadId, sentence);

    await ChatThread.findById(threadId).then(async (thread) => {
      if (thread && thread.messages.length > 0) {
        const lastMessage = thread.messages[thread.messages.length - 1];
        lastMessage.content += sentence;
        await thread.save();
      }

      return ChatThread.findByIdAndUpdate(threadId, {
        $pop: { pendingSentences: -1 },
      });
    });
  }
}
