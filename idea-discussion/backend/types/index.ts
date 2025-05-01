import { Document, Types } from "mongoose";

export interface BaseDocument extends Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ITheme extends BaseDocument {
  title: string;
  description?: string;
  slug: string;
  isActive: boolean;
}

export interface ISharpQuestion extends BaseDocument {
  themeId: Types.ObjectId;
  content: string;
  order?: number;
}

export interface IProblem extends BaseDocument {
  themeId: Types.ObjectId;
  content: string;
  source: string;
  extractedFrom?: Types.ObjectId;
}

export interface ISolution extends BaseDocument {
  themeId: Types.ObjectId;
  content: string;
  source: string;
  extractedFrom?: Types.ObjectId;
}

export interface IChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface IChatThread extends BaseDocument {
  themeId: Types.ObjectId;
  messages: IChatMessage[];
  userId?: string;
  sessionId: string;
}

export interface IQuestionLink extends BaseDocument {
  questionId: Types.ObjectId;
  linkedItemId: Types.ObjectId;
  linkedItemType: "problem" | "solution";
  relevanceScore: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface EnhancedTheme {
  _id: Types.ObjectId;
  title: string;
  description: string;
  slug: string;
  keyQuestionCount: number;
  commentCount: number;
}

export interface ThemeDetailResponse {
  theme: ITheme;
  keyQuestions: Array<
    ISharpQuestion & {
      issueCount: number;
      solutionCount: number;
      voteCount: number;
    }
  >;
  issues: IProblem[];
  solutions: ISolution[];
}
