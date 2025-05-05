import { socketClient } from "../services/socket/socketClient";
import type { NewExtractionEvent } from "../services/socket/socketClient";
import {
  Message,
  MessageType,
  SystemMessage,
  SystemNotification,
  UserMessage,
} from "../types";

export interface BaseChatManagerOptions {
  themeId: string;
  onNewMessage?: (message: Message) => void;
  onNewExtraction?: (extraction: NewExtractionEvent) => void;
}

export class BaseChatManager {
  protected themeId: string;
  protected messages: Message[] = [];
  protected onNewMessage?: (message: Message) => void;
  protected onNewExtraction?: (extraction: NewExtractionEvent) => void;
  protected threadId?: string;
  protected unsubscribeNewExtraction?: () => void;
  protected unsubscribeExtractionUpdate?: () => void;
  protected userId = `user-${Date.now()}`; // 仮のユーザーID

  constructor(options: BaseChatManagerOptions) {
    this.themeId = options.themeId;
    this.onNewMessage = options.onNewMessage;
    this.onNewExtraction = options.onNewExtraction;
  }

  async addMessage(content: string, type: MessageType): Promise<void> {
    switch (type) {
      case "user": {
        this.subscribeToExtraction();
        const userMessage = new UserMessage(content);

        this.messages.push(userMessage);
        this.onNewMessage?.(userMessage);

        await this.sendMessageToBackend(content);
        return;
      }
      case "system": {
        const systemMessage = new SystemMessage(content);
        this.messages.push(systemMessage);
        this.onNewMessage?.(systemMessage);
        break;
      }
      case "system-message": {
        const systemNotification = new SystemNotification(content);
        this.messages.push(systemNotification);
        this.onNewMessage?.(systemNotification);
        break;
      }
      default: {
        const defaultMessage = new SystemMessage(content);
        this.messages.push(defaultMessage);
        this.onNewMessage?.(defaultMessage);
      }
    }
  }

  protected async sendMessageToBackend(_userMessage: string): Promise<void> {
    throw new Error("Method not implemented");
  }

  protected subscribeToExtraction(): void {
    console.log(`[BaseChatManager] Subscribing to theme: ${this.themeId}`);
    socketClient.subscribeToTheme(this.themeId);
    if (this.threadId) {
      console.log(`[BaseChatManager] Subscribing to thread: ${this.threadId}`);
      socketClient.subscribeToThread(this.threadId);
    }

    if (this.unsubscribeNewExtraction) {
      console.log(
        "[BaseChatManager] Unsubscribing from previous new-extraction"
      );
      this.unsubscribeNewExtraction();
    }
    if (this.unsubscribeExtractionUpdate) {
      console.log(
        "[BaseChatManager] Unsubscribing from previous extraction-update"
      );
      this.unsubscribeExtractionUpdate();
    }

    console.log("[BaseChatManager] Registering new-extraction handler");
    this.unsubscribeNewExtraction = socketClient.onNewExtraction(
      this.handleNewExtraction.bind(this)
    );
    console.log("[BaseChatManager] Registering extraction-update handler");
    this.unsubscribeExtractionUpdate = socketClient.onExtractionUpdate(
      this.handleExtractionUpdate.bind(this)
    );
  }

  protected handleNewExtraction(event: NewExtractionEvent): void {
    console.log(
      "[BaseChatManager] handleNewExtraction called with event:",
      event
    );
    const { type, data } = event;
    const notificationContent =
      type === "problem"
        ? `「${data.statement}」という課題が登録されました。`
        : `「${data.statement}」という解決策が登録されました。`;

    console.log(
      `[BaseChatManager] Creating notification: ${notificationContent}`
    );
    const notification = new SystemNotification(notificationContent);
    this.messages.push(notification);

    console.log("[BaseChatManager] Calling onNewMessage callback");
    this.onNewMessage?.(notification);

    console.log("[BaseChatManager] Calling onNewExtraction callback");
    this.onNewExtraction?.(event);
  }

  protected handleExtractionUpdate(event: NewExtractionEvent): void {
    this.onNewExtraction?.(event);
  }

  setThreadId(threadId: string): void {
    this.threadId = threadId;
    socketClient.subscribeToThread(threadId);
  }

  cleanup(): void {
    if (this.unsubscribeNewExtraction) {
      this.unsubscribeNewExtraction();
    }
    if (this.unsubscribeExtractionUpdate) {
      this.unsubscribeExtractionUpdate();
    }

    socketClient.unsubscribeFromTheme(this.themeId);
    if (this.threadId) {
      socketClient.unsubscribeFromThread(this.threadId);
    }
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }
}
