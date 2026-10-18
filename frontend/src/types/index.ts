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
  isDynamic: boolean;
  image: string;
  internalPort: number;
  defaultTtl: number;
  memoryLimitMb: number;
  cpuLimit: number;
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
  isDynamic: boolean;
  image: string;
  internalPort: number;
  defaultTtl: number;
  memoryLimitMb: number;
  cpuLimit: number;
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

export type InstanceStatus = 'running' | 'stopped' | 'expired' | 'error';

export interface Instance {
  id: number;
  userId: number;
  challengeId: number;
  containerId: string;
  image: string;
  host: string;
  port: number;
  internalPort: number;
  status: InstanceStatus;
  errorMessage: string;
  expiresAt: string;
  startedAt: string;
  stoppedAt?: string;
  createdAt: string;
  updatedAt: string;
  challenge?: Challenge;
}

export interface StartInstanceResult {
  instance: Instance;
  connection: string;
  flag?: string;
}

export interface Announcement {
  id: number;
  title: string;
  contentMd: string;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface Discussion {
  id: number;
  challengeId: number;
  userId: number;
  parentId?: number;
  contentMd: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  user?: User;
  replies?: Discussion[];
  liked?: boolean;
}

export type NotificationKind = 'solve' | 'reply' | 'announcement' | 'system';

export interface AppNotification {
  id: number;
  userId: number;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  readAt?: string;
  createdAt: string;
}
