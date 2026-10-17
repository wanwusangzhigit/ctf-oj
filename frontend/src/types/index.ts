export type Role = 'user' | 'admin';

export interface User {
  id: number;
  username: string;
  email: string;
  bio: string;
  role: Role;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export interface Challenge {
  id: number;
  categoryId: number;
  title: string;
  description: string;
  baseScore: number;
  minScore: number;
  decay: number;
  difficulty: number;
  isPublished: boolean;
  connectionInfo: string;
  tags: string;
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeView {
  id: number;
  categoryId: number;
  title: string;
  description: string;
  baseScore: number;
  minScore: number;
  decay: number;
  difficulty: number;
  isPublished: boolean;
  connectionInfo: string;
  tags: string;
  category?: Category;
  createdAt: string;
  updatedAt: string;
  solveCount: number;
  userScore: number;
  solved: boolean;
  attachments: Attachment[];
}

export type FlagType = 'static' | 'regex';

export interface Attachment {
  id: number;
  challengeId: number;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface SubmissionResult {
  correct: boolean;
  score: number;
  message: string;
}

export interface Solve {
  id: number;
  userId: number;
  challengeId: number;
  score: number;
  isFirstBlood: boolean;
  solvedAt: string;
  user?: User;
  challenge?: Challenge;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  code: number;
  message: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}
