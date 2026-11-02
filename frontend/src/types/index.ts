export type Role = 'user' | 'challenge_admin' | 'competition_admin' | 'moderator' | 'admin';

export interface PublicUser {
  id: number;
  username: string;
  bio: string;
  role: Role;
  score: number;
  hasAvatar?: boolean;
  createdAt: string;
}

export interface User extends PublicUser {
  email?: string;
  isBanned?: boolean;
  bannedAt?: string;
  bannedReason?: string;
  scoreExcluded?: boolean;
  profileVisibility?: 'public' | 'private';
  privateProfile?: boolean;
  emailVerifiedAt?: string;
  updatedAt?: string;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  twoFactorEnabled?: boolean;
  permissions?: string[];
  delegations?: Delegation[];
}

export interface FeedItem {
  kind: 'solve' | 'writeup';
  userId: number;
  username: string;
  challengeId: number;
  challengeTitle: string;
  title?: string;
  createdAt: string;
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
  status: ChallengeStatus;
  isPublished: boolean;
  connectionInfo: string;
  tags: string;
  isDynamic: boolean;
  image: string;
  internalPort: number;
  protocol: ChallengeProtocol;
  sourceType: ChallengeSourceType;
  buildContext: string;
  defaultTtl: number;
  memoryLimitMb: number;
  cpuLimit: number;
  pidsLimit: number;
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

export type ChallengeStatus = 'draft' | 'hidden' | 'published' | 'archived';

export type AccessSubjectType = 'user' | 'team' | 'group';

export type AccessPermission = 'view' | 'manage';

export interface AccessSubject {
  type: AccessSubjectType;
  id: number;
  name: string;
  permission?: AccessPermission;
}

export interface Delegation {
  resourceType: 'challenge' | 'competition';
  resourceId: number;
  name: string;
  permission: AccessPermission;
}

export interface AccessGroup {
  id: number;
  name: string;
  description: string;
  members: AccessSubject[];
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
  status: ChallengeStatus;
  isPublished: boolean;
  connectionInfo: string;
  tags: string;
  isDynamic: boolean;
  image: string;
  internalPort: number;
  protocol: ChallengeProtocol;
  sourceType: ChallengeSourceType;
  buildContext: string;
  defaultTtl: number;
  memoryLimitMb: number;
  cpuLimit: number;
  pidsLimit: number;
  category?: Category;
  createdAt: string;
  updatedAt: string;
  editorial?: string;
  solveCount: number;
  userScore: number;
  solved: boolean;
  competitionId?: number;
  competitionSolved: boolean;
  competitionScore: number;
  attachments: Attachment[];
  flags?: AdminFlag[];
  accessGrants?: AccessSubject[];
}

export interface AdminFlag {
  id: number;
  type: FlagType;
  content: string;
  caseSensitive: boolean;
}

export type FlagType = 'static' | 'regex';

export type ChallengeProtocol = 'tcp' | 'http';

export type ChallengeSourceType = 'image' | 'dockerfile' | 'compose';

export interface SourceEntry {
  path: string;
  size: number;
}

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
  alreadySolved?: boolean;
  competitionId?: number;
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

export interface AuthResponse {
  user: User;
}

export type InstanceStatus = 'running' | 'stopped' | 'expired' | 'auto_expired' | 'error';

export interface Instance {
  connection?: string;
  id: number;
  userId: number;
  teamId?: number;
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
  user?: Pick<User, 'id' | 'username'>;
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

export type DiscussionScope = 'challenge' | 'community' | 'team' | 'competition';

export interface Discussion {
  id: number;
  scope: DiscussionScope;
  challengeId?: number;
  teamId?: number;
  competitionId?: number;
  title?: string;
  userId: number;
  parentId?: number;
  contentMd: string;
  likeCount: number;
  viewCount: number;
  replyCount: number;
  lastReplyAt?: string;
  isPinned: boolean;
  isLocked: boolean;
  tags: string;
  editedAt?: string;
  editCount: number;
  createdAt: string;
  updatedAt: string;
  user?: PublicUser;
  replies?: Discussion[];
  liked?: boolean;
}

export interface DiscussionRevision {
  id: number;
  discussionId: number;
  revision: number;
  title?: string;
  contentMd: string;
  actorId?: number;
  actor?: PublicUser;
  createdAt: string;
}

export type CommunityVisibility = 'public' | 'members' | 'restricted';
export type CommunityPosting = 'members' | 'restricted';

export interface CommunityMeta {
  visibility: CommunityVisibility;
  posting: CommunityPosting;
  canView: boolean;
  canPost: boolean;
  canModerate: boolean;
  copy?: Record<string, string>;
}

export interface CommunityAdmin {
  visibility: CommunityVisibility;
  posting: CommunityPosting;
  grants: AccessSubject[];
}

export interface Writeup {
  id: number;
  challengeId: number;
  title: string;
  contentMd: string;
  isPublished: boolean;
  author: PublicUser;
  createdAt: string;
  updatedAt: string;
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

export interface Team {
  id: number;
  name: string;
  slug: string;
  description: string;
  ownerId: number;
  inviteCode: string;
  score: number;
  createdAt: string;
  updatedAt: string;
  owner?: PublicUser;
  members?: TeamMember[];
}

export interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  joinedAt: string;
  user?: PublicUser;
}

export interface Overview {
  totalUsers: number;
  activeUsers: number;
  totalChallenges: number;
  publishedCount: number;
  totalSolves: number;
  totalSubmissions: number;
  runningInstances: number;
  totalTeams: number;
}

export interface CategoryStat {
  categoryId: number;
  categoryName: string;
  slug: string;
  count: number;
  solves: number;
}

export interface TrendPoint {
  date: string;
  solves: number;
}

export interface RecentSolve {
  username: string;
  challengeId: number;
  challengeName: string;
  score: number;
  isFirstBlood: boolean;
  solvedAt: string;
}

export interface ImportSummary {
  categoriesCreated: number;
  challengesCreated: number;
  challengesSkipped: number;
  challengesFailed: number;
  attachmentsLinked: number;
}

// ----- Phase-2 additions -----

export interface SiteSettingsPublic {
  siteName: string;
  siteTagline: string;
  siteRulesMd: string;
  registrationOpen: boolean;
  emailVerificationRequired: boolean;
  passwordResetEnabled: boolean;
  hasRegistrationCode: boolean;
  hasActiveCompetition: boolean;
}

export interface SiteSetting {
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: number;
}

export interface AuditLogEntry {
  id: number;
  actorId: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId: number;
  payload: string;
  ip: string;
  createdAt: string;
}

export interface Hint {
  id: number;
  challengeId: number;
  sortOrder: number;
  costRatio: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** Public hint view — content is masked unless unlocked. */
export interface HintView {
  id: number;
  sortOrder: number;
  costRatio: number;
  unlocked: boolean;
  content?: string;
}

export interface Competition {
  id: number;
  name: string;
  slug: string;
  description: string;
  startAt?: string;
  endAt?: string;
  freezeAt?: string;
  visibility: 'public' | 'private';
  scoringMode: 'dynamic' | 'fixed' | 'three_blood';
  archivedAt?: string;
  isActive: boolean;
  registrationCode?: string;
  registrationRequired: boolean;
  hasRegistrationCode?: boolean;
  registered?: boolean;
  registrationCount?: number;
  scoreboardFrozen?: boolean;
  boundChallengeCount?: number;
  accessGrants?: AccessSubject[];
  challenges?: Pick<
    Challenge,
    'id' | 'title' | 'categoryId' | 'difficulty' | 'status' | 'baseScore' | 'category'
  >[];
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionInput {
  name: string;
  slug: string;
  description: string;
  startAt?: string;
  endAt?: string;
  freezeAt?: string;
  registrationCode?: string;
  registrationRequired?: boolean;
  visibility?: 'public' | 'private';
  scoringMode?: 'dynamic' | 'fixed' | 'three_blood';
  challengeIds?: number[];
  archived?: boolean;
  isActive?: boolean;
  accessGrants?: AccessSubject[];
}

export interface CompetitionRegistration {
  competitionId: number;
  userId: number;
  scoreExcluded: boolean;
  excludedReason?: string;
  excludedAt?: string;
  excludedBy?: number;
  createdAt: string;
  user?: User;
}

export interface CompetitionAnnouncement {
  id: number;
  competitionId: number;
  title: string;
  contentMd: string;
  isPublished: boolean;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHit {
  type: 'challenge' | 'user' | 'team' | 'announcement';
  id: number;
  title: string;
  subtitle?: string;
}

export interface TeamScore {
  id: number;
  name: string;
  slug: string;
  score: number;
}

export interface SubmissionWithChallenge {
  id: number;
  userId: number;
  challengeId: number;
  competitionId?: number;
  flag: string;
  isCorrect: boolean;
  ip?: string;
  createdAt: string;
  challenge?: Pick<Challenge, 'id' | 'title' | 'categoryId'>;
}

export interface SubmissionTrendPoint {
  date: string;
  submissions: number;
}

export interface PodiumEntry {
  rank: number;
  username: string;
  userId: number;
  score: number;
  solvedAt: string;
}

export interface Achievement {
  key: string;
  label: string;
  description: string;
  progress: number;
  target: number;
  earned: boolean;
}
