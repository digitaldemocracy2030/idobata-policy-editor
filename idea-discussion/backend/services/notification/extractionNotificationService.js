/**
 * 抽出通知サービス
 * 抽出結果をWebSocketを通じてクライアントに通知する
 */
class ExtractionNotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * 新しい問題抽出を通知
   * @param {Object} problem - 抽出された問題オブジェクト
   * @param {string} themeId - テーマID
   * @param {string} threadId - スレッドID
   */
  notifyNewProblem(problem, themeId, threadId) {
    if (themeId) {
      const room = `theme:${themeId}`;
      this.io.to(room).emit("new-extraction", {
        type: "problem",
        data: problem,
      });
      this._logEvent(
        "new-extraction",
        { type: "problem", data: problem },
        room
      );
    }
    
    if (threadId) {
      const room = `thread:${threadId}`;
      this.io.to(room).emit("new-extraction", {
        type: "problem",
        data: problem,
      });
      this._logEvent(
        "new-extraction",
        { type: "problem", data: problem },
        room
      );
    }
  }

  /**
   * 新しい解決策抽出を通知
   * @param {Object} solution - 抽出された解決策オブジェクト
   * @param {string} themeId - テーマID
   * @param {string} threadId - スレッドID
   */
  notifySolution(solution, themeId, threadId) {
    if (themeId) {
      const room = `theme:${themeId}`;
      this.io.to(room).emit("new-extraction", {
        type: "solution",
        data: solution,
      });
      this._logEvent(
        "new-extraction",
        { type: "solution", data: solution },
        room
      );
    }
    
    if (threadId) {
      const room = `thread:${threadId}`;
      this.io.to(room).emit("new-extraction", {
        type: "solution",
        data: solution,
      });
      this._logEvent(
        "new-extraction",
        { type: "solution", data: solution },
        room
      );
    }
  }

  /**
   * 抽出の更新を通知
   * @param {string} type - 'problem' または 'solution'
   * @param {Object} data - 更新されたデータ
   * @param {string} themeId - テーマID
   * @param {string} threadId - スレッドID
   */
  notifyExtractionUpdate(type, data, themeId, threadId) {
    if (themeId) {
      const room = `theme:${themeId}`;
      this.io.to(room).emit("extraction-update", {
        type,
        data,
      });
      this._logEvent(
        "extraction-update",
        { type, data },
        room
      );
    }
    
    if (threadId) {
      const room = `thread:${threadId}`;
      this.io.to(room).emit("extraction-update", {
        type,
        data,
      });
      this._logEvent(
        "extraction-update",
        { type, data },
        room
      );
    }
  }

  /**
   * イベントをログに記録
   * @private
   * @param {string} event - イベント名
   * @param {Object} data - イベントデータ
   * @param {string} room - 送信先のルーム
   */
  _logEvent(event, data, room) {
    console.log(
      `[WebSocket] Emitting '${event}' to ${room}:`,
      JSON.stringify({
        type: data.type,
        id: data.data._id,
        timestamp: new Date().toISOString(),
      })
    );
  }
}

export default ExtractionNotificationService;
