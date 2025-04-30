import type { Dispatch, SetStateAction } from "react";

// React関連の型定義
export interface OutletContext {
  userId: string | null;
  setUserId: Dispatch<SetStateAction<string | null>>;
}

// メッセージ関連の型定義
export interface Message {
  role: string;
  content: string;
  timestamp: string | Date;
}

// 通知関連の型定義
export interface NotificationType {
  message: string;
  type: string;
  id: string;
}

export interface PreviousExtractions {
  problems: Problem[];
  solutions: Solution[];
}

// ドメインオブジェクトの型定義
export interface Problem {
  _id: string;
  statement: string;
  version?: number;
  sourceType?: string;
  createdAt?: string;
}

export interface Solution {
  _id: string;
  statement: string;
  version?: number;
  sourceType?: string;
  createdAt?: string;
}

export interface Question {
  _id: string;
  questionText: string;
  createdAt?: string;
}

export interface PolicyDraft {
  _id: string;
  title: string;
  content: string;
  version?: number;
  createdAt: string;
}

export interface DigestDraft {
  _id: string;
  title: string;
  content: string;
  version?: number;
  createdAt: string;
}

export interface RelatedProblem extends Problem {
  relevanceScore: number;
}

export interface RelatedSolution extends Solution {
  relevanceScore: number;
}

export interface QuestionDetails {
  question: Question;
  relatedProblems: RelatedProblem[];
  relatedSolutions: RelatedSolution[];
}

// UI関連の型定義
export type TabType = "questions" | "problems" | "solutions" | "policies";

export interface Theme {
  _id: string;
  title: string;
  description?: string;
  slug: string;
  keyQuestionCount?: number;
  commentCount?: number;
}

export type MessageType = "user" | "system" | "system-message" | "notification";

export interface ExtendedMessage extends Message {
  type: MessageType;
  isStreaming?: boolean;
  id?: string;
}
