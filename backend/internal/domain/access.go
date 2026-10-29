package domain

import "time"

type AccessSubjectType string

const (
	SubjectUser  AccessSubjectType = "user"
	SubjectTeam  AccessSubjectType = "team"
	SubjectGroup AccessSubjectType = "group"
)

type AccessPermission string

const (
	AccessView   AccessPermission = "view"
	AccessManage AccessPermission = "manage"
)

type ChallengeGroup struct {
	ID          uint                   `gorm:"primaryKey" json:"id"`
	Name        string                 `gorm:"size:64;not null;uniqueIndex" json:"name"`
	Description string                 `gorm:"type:text;not null;default:''" json:"description"`
	CreatedAt   time.Time              `json:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt"`
	Members     []ChallengeGroupMember `gorm:"foreignKey:GroupID" json:"members,omitempty"`
}

func (ChallengeGroup) TableName() string { return "challenge_groups" }

type ChallengeGroupMember struct {
	GroupID     uint              `gorm:"primaryKey" json:"groupId"`
	SubjectType AccessSubjectType `gorm:"primaryKey;size:16;not null" json:"subjectType"`
	SubjectID   uint              `gorm:"primaryKey" json:"subjectId"`
}

func (ChallengeGroupMember) TableName() string { return "challenge_group_members" }

type ChallengeAccessGrant struct {
	ChallengeID uint              `gorm:"primaryKey" json:"challengeId"`
	SubjectType AccessSubjectType `gorm:"primaryKey;size:16;not null" json:"subjectType"`
	SubjectID   uint              `gorm:"primaryKey" json:"subjectId"`
	Permission  AccessPermission  `gorm:"size:16;not null;default:view" json:"permission"`
}

func (ChallengeAccessGrant) TableName() string { return "challenge_access_grants" }

type CompetitionAccessGrant struct {
	CompetitionID uint              `gorm:"primaryKey" json:"competitionId"`
	SubjectType   AccessSubjectType `gorm:"primaryKey;size:16;not null" json:"subjectType"`
	SubjectID     uint              `gorm:"primaryKey" json:"subjectId"`
	Permission    AccessPermission  `gorm:"size:16;not null;default:view" json:"permission"`
}

func (CompetitionAccessGrant) TableName() string { return "competition_access_grants" }

type CommunityAccessGrant struct {
	SubjectType AccessSubjectType `gorm:"primaryKey;size:16;not null" json:"subjectType"`
	SubjectID   uint              `gorm:"primaryKey" json:"subjectId"`
	Permission  AccessPermission  `gorm:"size:16;not null;default:view" json:"permission"`
	CreatedAt   time.Time         `json:"createdAt"`
}

func (CommunityAccessGrant) TableName() string { return "community_access_grants" }

// AccessSubject is a resolved grant/member target for the admin UI.
type AccessSubject struct {
	Type       string           `json:"type"`
	ID         uint             `json:"id"`
	Name       string           `json:"name"`
	Permission AccessPermission `json:"permission,omitempty"`
}

// Delegation describes a resource-level permission granted to the current user.
type Delegation struct {
	ResourceType string           `json:"resourceType"`
	ResourceID   uint             `json:"resourceId"`
	Name         string           `json:"name"`
	Permission   AccessPermission `json:"permission"`
}

type ChallengeGroupView struct {
	ID          uint            `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Members     []AccessSubject `json:"members"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}
