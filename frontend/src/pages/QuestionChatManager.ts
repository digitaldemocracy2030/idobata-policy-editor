import { apiClient } from "../services/api/apiClient";
import { BaseChatManager, BaseChatManagerOptions } from "./BaseChatManager";
import { SystemMessage, SystemNotification } from "../types";

export interface QuestionChatManagerOptions extends BaseChatManagerOptions {
  questionId: string;
  questionText: string;
}

export class QuestionChatManager extends BaseChatManager {
  private questionId: string;
  private questionText: string;
  private hasShownNotification = false; // Flag to track if notification has been shown

  constructor(options: QuestionChatManagerOptions) {
    super(options);
    this.questionId = options.questionId;
    this.questionText = options.questionText;
    this.showQuestionNotification();
  }

  private showQuestionNotification(): void {
    if (this.hasShownNotification) return; // Skip if notification already shown

    const notification = new SystemNotification(
      `「${this.questionText}」がチャット対象になりました。`
    );
    this.messages.push(notification);
    this.onNewMessage?.(notification);

    this.hasShownNotification = true; // Mark notification as shown
  }

  protected async sendMessageToBackend(userMessage: string): Promise<void> {
    try {
      const result = await apiClient.sendQuestionMessage(
        this.userId,
        userMessage,
        this.themeId,
        this.questionId,
        this.threadId
      );

      if (result.isOk()) {
        const { response, threadId } = result.value;

        if (threadId && !this.threadId) {
          this.setThreadId(threadId);
        }

        if (response) {
          const systemResponse = new SystemMessage(response);
          this.messages.push(systemResponse);
          this.onNewMessage?.(systemResponse);
        }
      } else {
        const errorMessage = new SystemMessage(
          "メッセージの送信中にエラーが発生しました。"
        );
        this.messages.push(errorMessage);
        this.onNewMessage?.(errorMessage);
        console.error("Error sending message:", result.error);
      }
    } catch (error) {
      console.error("Error in sendMessageToBackend:", error);
      const errorMessage = new SystemMessage(
        "メッセージの送信中にエラーが発生しました。"
      );
      this.messages.push(errorMessage);
      this.onNewMessage?.(errorMessage);
    }
  }

  protected subscribeToExtraction(): void {
    console.log(
      `[QuestionChatManager] Subscribing to theme: ${this.themeId} and question: ${this.questionId}`
    );
    super.subscribeToExtraction();
  }
}
