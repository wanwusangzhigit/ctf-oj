package domain

import (
	"context"
	"io"
	"time"
)

type UserRepository interface {
	Create(ctx context.Context, u *User) error
	FindByID(ctx context.Context, id uint) (*User, error)
	FindByUsername(ctx context.Context, username string) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	Update(ctx context.Context, u *User) error
	List(ctx context.Context, page, pageSize int) ([]*User, int64, error)
	Search(ctx context.Context, filter UserFilter, page, pageSize int) ([]*User, int64, error)
	UpdateScore(ctx context.Context, userID uint, delta int) error
	SetBanned(ctx context.Context, id uint, banned bool, reason string) error
	SetRole(ctx context.Context, id uint, role Role) error
	SetScoreExcluded(ctx context.Context, id uint, excluded bool) error
}

type FollowRepository interface {
	Follow(ctx context.Context, followerID, followeeID uint) error
	Unfollow(ctx context.Context, followerID, followeeID uint) error
	IsFollowing(ctx context.Context, followerID, followeeID uint) (bool, error)
	CountFollowers(ctx context.Context, userID uint) (int64, error)
	CountFollowing(ctx context.Context, userID uint) (int64, error)
	ListFollowers(ctx context.Context, userID uint, page, pageSize int) ([]*User, int64, error)
	ListFollowing(ctx context.Context, userID uint, page, pageSize int) ([]*User, int64, error)
	Feed(ctx context.Context, userID uint, limit int) ([]*FeedItem, error)
}

type SearchRepository interface {
	Search(ctx context.Context, query string, limit int) ([]*SearchHit, error)
}

type UserFilter struct {
	Query  string
	Role   string
	Banned *bool
}

type CategoryRepository interface {
	Create(ctx context.Context, c *Category) error
	FindByID(ctx context.Context, id uint) (*Category, error)
	FindBySlug(ctx context.Context, slug string) (*Category, error)
	List(ctx context.Context) ([]*Category, error)
	Update(ctx context.Context, c *Category) error
	Delete(ctx context.Context, id uint) error
}

type ChallengeRepository interface {
	Create(ctx context.Context, c *Challenge) error
	FindByID(ctx context.Context, id uint) (*Challenge, error)
	List(ctx context.Context, filter ChallengeFilter) ([]*Challenge, int64, error)
	Update(ctx context.Context, c *Challenge) error
	Delete(ctx context.Context, id uint) error
	CountSolves(ctx context.Context, challengeID uint) (int64, error)
}

type ChallengeFilter struct {
	CategoryID      uint
	OnlyPublished   bool
	AccessUserID    uint
	AccessTeamID    uint
	Query           string
	Status          string
	Difficulty      int
	IsDynamic       *bool
	SolvedBy        uint
	Solved          *bool
	CompetitionID   uint
	ManagedByUserID uint
	ManagedByTeamID uint
	Page            int
	PageSize        int
}

type ChallengeAccessRepository interface {
	ListGroups(ctx context.Context) ([]*ChallengeGroup, error)
	FindGroupByID(ctx context.Context, id uint) (*ChallengeGroup, error)
	FindGroupByName(ctx context.Context, name string) (*ChallengeGroup, error)
	CreateGroup(ctx context.Context, g *ChallengeGroup) error
	UpdateGroup(ctx context.Context, g *ChallengeGroup) error
	DeleteGroup(ctx context.Context, id uint) error
	ReplaceGroupMembers(ctx context.Context, groupID uint, members []ChallengeGroupMember) error
	ListGrants(ctx context.Context, challengeID uint) ([]*ChallengeAccessGrant, error)
	ReplaceGrants(ctx context.Context, challengeID uint, grants []ChallengeAccessGrant) error
	HasAccess(ctx context.Context, challengeID, userID, teamID uint) (bool, error)
	AccessLevel(ctx context.Context, challengeID, userID, teamID uint) (AccessPermission, error)
	ListCompetitionGrants(ctx context.Context, competitionID uint) ([]*CompetitionAccessGrant, error)
	ReplaceCompetitionGrants(ctx context.Context, competitionID uint, grants []CompetitionAccessGrant) error
	CompetitionAccessLevel(ctx context.Context, competitionID, userID, teamID uint) (AccessPermission, error)
	ManagedCompetitionIDs(ctx context.Context, userID, teamID uint) ([]uint, error)
	ListDelegations(ctx context.Context, userID, teamID uint) ([]Delegation, error)
	SearchSubjects(ctx context.Context, subjectType AccessSubjectType, query string, limit int) ([]AccessSubject, error)
}

type FlagRepository interface {
	Create(ctx context.Context, f *Flag) error
	FindByChallengeID(ctx context.Context, challengeID uint) ([]*Flag, error)
	DeleteByChallengeID(ctx context.Context, challengeID uint) error
}

type AttachmentRepository interface {
	Create(ctx context.Context, a *Attachment) error
	FindByID(ctx context.Context, id uint) (*Attachment, error)
	ListByChallengeID(ctx context.Context, challengeID uint) ([]*Attachment, error)
	Delete(ctx context.Context, id uint) error
}

type SubmissionRepository interface {
	Create(ctx context.Context, s *Submission) error
	ListByUserAndChallenge(ctx context.Context, userID, challengeID uint, limit int) ([]*Submission, error)
	CountRecent(ctx context.Context, userID uint, since interface{}) (int64, error)
	ListByUser(ctx context.Context, userID uint, page, pageSize int) ([]*Submission, int64, error)
	ListAll(ctx context.Context, page, pageSize int, filter SubmissionListFilter) ([]*Submission, int64, error)
}

type SubmissionListFilter struct {
	UserID      uint
	ChallengeID uint
	IsCorrect   *bool
}

type SolveRepository interface {
	Create(ctx context.Context, s *Solve) error
	FindByUserAndChallenge(ctx context.Context, userID, challengeID uint) (*Solve, error)
	CountByChallenge(ctx context.Context, challengeID uint) (int64, error)
	ListByChallenge(ctx context.Context, challengeID uint, page, pageSize int) ([]*Solve, int64, error)
	ListByUser(ctx context.Context, userID uint) ([]*Solve, error)
	ListTop(ctx context.Context, limit int) ([]*Solve, error)
	ListScoreboard(ctx context.Context, page, pageSize int) ([]*User, int64, error)
	ListScoreboardAt(ctx context.Context, cutoff time.Time, page, pageSize int) ([]*User, int64, error)
	SumScoreByUserUntil(ctx context.Context, userID uint, cutoff time.Time) (int, error)
}

type CompetitionSolveRepository interface {
	Create(ctx context.Context, s *CompetitionSolve) error
	FindByUserAndChallenge(ctx context.Context, competitionID, userID, challengeID uint) (*CompetitionSolve, error)
	CountByCompetitionChallenge(ctx context.Context, competitionID, challengeID uint) (int64, error)
}

type InstanceRepository interface {
	Create(ctx context.Context, i *Instance) error
	FindByID(ctx context.Context, id uint) (*Instance, error)
	FindByUserAndChallenge(ctx context.Context, userID, challengeID uint) (*Instance, error)
	FindActiveByUserAndChallenge(ctx context.Context, userID, challengeID uint) (*Instance, error)
	FindActiveByTeamAndChallenge(ctx context.Context, teamID, challengeID uint) (*Instance, error)
	ListByUser(ctx context.Context, userID uint) ([]*Instance, error)
	ListByUserOrTeam(ctx context.Context, userID, teamID uint) ([]*Instance, error)
	ListAll(ctx context.Context, page, pageSize int, filter InstanceListFilter) ([]*Instance, int64, error)
	ListExpired(ctx context.Context, now time.Time) ([]*Instance, error)
	ListActive(ctx context.Context) ([]*Instance, error)
	Update(ctx context.Context, i *Instance) error
	UpdateStatus(ctx context.Context, id uint, status InstanceStatus, errMsg string) error
	Delete(ctx context.Context, id uint) error
	CountActiveByUser(ctx context.Context, userID uint) (int64, error)
	CountActiveByTeam(ctx context.Context, teamID uint) (int64, error)
}

type InstanceListFilter struct {
	UserID      uint
	ChallengeID uint
	Status      InstanceStatus
}

type AnnouncementRepository interface {
	Create(ctx context.Context, a *Announcement) error
	FindByID(ctx context.Context, id uint) (*Announcement, error)
	List(ctx context.Context, onlyPublished bool, page, pageSize int) ([]*Announcement, int64, error)
	Update(ctx context.Context, a *Announcement) error
	Delete(ctx context.Context, id uint) error
}

type WriteupRepository interface {
	Create(ctx context.Context, w *Writeup) error
	FindByID(ctx context.Context, id uint) (*Writeup, error)
	ListByChallenge(ctx context.Context, challengeID uint, publishedOnly bool) ([]*Writeup, error)
	ListByUser(ctx context.Context, userID uint) ([]*Writeup, error)
	Update(ctx context.Context, w *Writeup) error
	Delete(ctx context.Context, id uint) error
}

type DiscussionRepository interface {
	Create(ctx context.Context, d *Discussion) error
	FindByID(ctx context.Context, id uint) (*Discussion, error)
	ListByChallenge(ctx context.Context, challengeID uint, page, pageSize int) ([]*Discussion, int64, error)
	ListByScope(ctx context.Context, scope DiscussionScope, targetID uint, opts DiscussionListOptions) ([]*Discussion, int64, error)
	ListReplies(ctx context.Context, parentID uint) ([]*Discussion, error)
	ListByUser(ctx context.Context, userID uint, limit int) ([]*Discussion, error)
	// UpdateColumns and ApplyEdit are column-scoped: a whole-row Save would
	// clobber the like/view/reply counters that concurrent statements maintain.
	UpdateColumns(ctx context.Context, id uint, fields map[string]any) error
	ApplyEdit(ctx context.Context, id uint, fields map[string]any, actorID uint) (*DiscussionRevision, error)
	ListRevisions(ctx context.Context, discussionID uint, page, pageSize int) ([]*DiscussionRevision, int64, error)
	Delete(ctx context.Context, id uint) error
	IncrLikeCount(ctx context.Context, id uint, delta int) error
	IncrViewCount(ctx context.Context, id uint) error
	TouchReply(ctx context.Context, parentID uint, at time.Time) error
	RefreshReplyStats(ctx context.Context, parentID uint) error
	CountReplies(ctx context.Context, parentID uint) (int64, error)
	CountTopicsBySection(ctx context.Context) (map[uint]int64, error)
}

type CommunitySectionRepository interface {
	Create(ctx context.Context, s *CommunitySection) error
	FindByID(ctx context.Context, id uint) (*CommunitySection, error)
	List(ctx context.Context) ([]*CommunitySection, error)
	Update(ctx context.Context, s *CommunitySection) error
	Delete(ctx context.Context, id uint) error
}

type CommunityAccessRepository interface {
	CommunityAccessLevel(ctx context.Context, userID, teamID uint) (AccessPermission, error)
	ListCommunityGrants(ctx context.Context) ([]*CommunityAccessGrant, error)
	ReplaceCommunityGrants(ctx context.Context, grants []CommunityAccessGrant) error
	FindGroupByID(ctx context.Context, id uint) (*ChallengeGroup, error)
	CommunitySectionAccessLevel(ctx context.Context, sectionID, userID, teamID uint) (AccessPermission, error)
	// SectionGrantLevels is one query for every board: section-level checks must
	// not scale with the number of sections.
	SectionGrantLevels(ctx context.Context, userID, teamID uint) (map[uint]AccessPermission, error)
	ListCommunitySectionGrants(ctx context.Context, sectionID uint) ([]*CommunitySectionAccessGrant, error)
	ReplaceCommunitySectionGrants(ctx context.Context, sectionID uint, grants []CommunitySectionAccessGrant) error
}

type DiscussionLikeRepository interface {
	Toggle(ctx context.Context, userID, discussionID uint) (liked bool, err error)
	HasLiked(ctx context.Context, userID, discussionID uint) (bool, error)
	HasLikedList(ctx context.Context, userID uint, ids []uint) (map[uint]bool, error)
}

type NotificationRepository interface {
	Create(ctx context.Context, n *Notification) error
	ListByUser(ctx context.Context, userID uint, page, pageSize int) ([]*Notification, int64, error)
	UnreadCount(ctx context.Context, userID uint) (int64, error)
	MarkRead(ctx context.Context, id uint, userID uint) error
	MarkAllRead(ctx context.Context, userID uint) error
}

type TeamRepository interface {
	Create(ctx context.Context, t *Team) error
	FindByID(ctx context.Context, id uint) (*Team, error)
	FindBySlug(ctx context.Context, slug string) (*Team, error)
	FindByName(ctx context.Context, name string) (*Team, error)
	FindByInviteCode(ctx context.Context, code string) (*Team, error)
	List(ctx context.Context, page, pageSize int) ([]*Team, int64, error)
	ListScoreboard(ctx context.Context, page, pageSize int) ([]*Team, int64, error)
	Update(ctx context.Context, t *Team) error
	Delete(ctx context.Context, id uint) error
	AddMember(ctx context.Context, m *TeamMember) error
	RemoveMember(ctx context.Context, teamID, userID uint) error
	ListMembers(ctx context.Context, teamID uint) ([]*TeamMember, error)
	FindMembership(ctx context.Context, userID uint) (*TeamMember, error)
	SumMemberScoresUntil(ctx context.Context, teamID uint, cutoff time.Time) (int, error)
}

type Storage interface {
	Save(ctx context.Context, reader io.Reader, originalName string) (*StoredObject, error)
	Open(ctx context.Context, key string) (io.ReadCloser, int64, error)
	Delete(ctx context.Context, key string) error
}

type StoredObject struct {
	Key  string
	Size int64
}

// --- Settings ---

type SettingRepository interface {
	List(ctx context.Context) ([]*SiteSetting, error)
	Get(ctx context.Context, key string) (*SiteSetting, error)
	GetMany(ctx context.Context, keys []string) ([]*SiteSetting, error)
	Upsert(ctx context.Context, s *SiteSetting) error
	UpsertMany(ctx context.Context, settings []*SiteSetting) error
}

type AuditLogRepository interface {
	Record(ctx context.Context, entry *AuditLog) error
	List(ctx context.Context, page, pageSize int, filter AuditLogFilter) ([]*AuditLog, int64, error)
}

type AuditLogFilter struct {
	ActorID    uint
	Action     string
	TargetType string
}

type CompetitionRepository interface {
	Create(ctx context.Context, c *Competition) error
	FindByID(ctx context.Context, id uint) (*Competition, error)
	FindActive(ctx context.Context) (*Competition, error)
	List(ctx context.Context, page, pageSize int) ([]*Competition, int64, error)
	Update(ctx context.Context, c *Competition) error
	Delete(ctx context.Context, id uint) error
	DeactivateAll(ctx context.Context) error
	SetChallenges(ctx context.Context, competitionID uint, challengeIDs []uint) error
	Scoreboard(ctx context.Context, competitionID uint, start, end time.Time, cutoff *time.Time, page, pageSize int) ([]*User, int64, error)
	TeamScoreboard(ctx context.Context, competitionID uint, start, end time.Time, cutoff *time.Time, page, pageSize int) ([]*TeamScore, int64, error)
}

type CompetitionRegistrationRepository interface {
	Create(ctx context.Context, r *CompetitionRegistration) error
	Find(ctx context.Context, competitionID, userID uint) (*CompetitionRegistration, error)
	Delete(ctx context.Context, competitionID, userID uint) error
	CountByCompetition(ctx context.Context, competitionID uint) (int64, error)
	ListByCompetition(ctx context.Context, competitionID uint, page, pageSize int) ([]*CompetitionRegistration, int64, error)
	SetScoreExcluded(ctx context.Context, competitionID, userID uint, excluded bool, reason string, actorID uint) (*CompetitionRegistration, error)
}

type CompetitionAnnouncementRepository interface {
	Create(ctx context.Context, a *CompetitionAnnouncement) error
	FindByID(ctx context.Context, id uint) (*CompetitionAnnouncement, error)
	ListByCompetition(ctx context.Context, competitionID uint, publishedOnly bool, page, pageSize int) ([]*CompetitionAnnouncement, int64, error)
	Update(ctx context.Context, a *CompetitionAnnouncement) error
	Delete(ctx context.Context, id uint) error
}

type EmailVerificationRepository interface {
	Create(ctx context.Context, ev *EmailVerification) error
	FindByToken(ctx context.Context, token string) (*EmailVerification, error)
	MarkUsed(ctx context.Context, id int64) error
}

type PasswordResetRepository interface {
	Create(ctx context.Context, pr *PasswordReset) error
	FindByToken(ctx context.Context, token string) (*PasswordReset, error)
	MarkUsed(ctx context.Context, id int64) error
}

// --- Hints ---

type HintRepository interface {
	Create(ctx context.Context, h *ChallengeHint) error
	FindByChallenge(ctx context.Context, challengeID uint) ([]*ChallengeHint, error)
	FindByID(ctx context.Context, id uint) (*ChallengeHint, error)
	Update(ctx context.Context, h *ChallengeHint) error
	Delete(ctx context.Context, id uint) error
	ListUnlocksByUser(ctx context.Context, userID, challengeID uint) ([]*HintUnlock, error)
	ListUnlockedHintIDs(ctx context.Context, userID uint, hintIDs []uint) ([]uint, error)
	Unlock(ctx context.Context, userID, hintID uint) error
}
