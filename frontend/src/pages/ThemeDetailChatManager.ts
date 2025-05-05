import { apiClient } from "../services/api/apiClient";
import { BaseChatManager, BaseChatManagerOptions } from "./BaseChatManager";
import { SystemMessage, SystemNotification } from "../types";

export interface ThemeDetailChatManagerOptions extends BaseChatManagerOptions {
  themeName: string;
}

export class ThemeDetailChatManager extends BaseChatManager {
  private themeName: string;

  constructor(options: ThemeDetailChatManagerOptions) {
    super(options);
    this.themeName = options.themeName;
    this.showThemeNotification();
  }

  private showThemeNotification(): void {
    const notification = new SystemNotification(
      `「${this.themeName}」がチャット対象になりました。`
    );
    this.messages.push(notification);
    this.onNewMessage?.(notification);
  }

  protected async sendMessageToBackend(userMessage: string): Promise<void> {
    try {
      const result = await apiClient.sendMessage(
        this.userId,
        userMessage,
        this.themeId,
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
}
