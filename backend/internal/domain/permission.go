package domain

type Permission string

const (
	PermOverviewView       Permission = "admin.overview"
	PermChallengeManage    Permission = "challenge.manage"
	PermChallengeExport    Permission = "challenge.export"
	PermCategoryManage     Permission = "category.manage"
	PermCompetitionManage  Permission = "competition.manage"
	PermCompetitionExport  Permission = "competition.export"
	PermUserManage         Permission = "user.manage"
	PermAnnouncementManage Permission = "announcement.manage"
	PermDiscussionModerate Permission = "discussion.moderate"
	PermCommunityManage    Permission = "community.manage"
	PermSettingsManage     Permission = "settings.manage"
	PermAuditView          Permission = "audit.view"
	PermInstanceManage     Permission = "instance.manage"
	PermBroadcastSend      Permission = "broadcast.send"
	PermServerManage       Permission = "server.manage"
)

var rolePermissions = map[Role][]Permission{
	RoleUser: {},
	RoleChallengeAdmin: {
		PermChallengeManage, PermChallengeExport, PermCategoryManage,
	},
	RoleCompetitionAdmin: {
		PermCompetitionManage, PermCompetitionExport,
	},
	RoleModerator: {
		PermAnnouncementManage, PermDiscussionModerate,
	},
	RoleAdmin: {
		PermOverviewView, PermChallengeManage, PermChallengeExport, PermCategoryManage,
		PermCompetitionManage, PermCompetitionExport, PermUserManage,
		PermAnnouncementManage, PermDiscussionModerate, PermCommunityManage, PermSettingsManage,
		PermAuditView, PermInstanceManage, PermBroadcastSend, PermServerManage,
	},
}

func PermissionsFor(role Role) []Permission {
	perms := rolePermissions[role]
	out := make([]Permission, len(perms))
	copy(out, perms)
	return out
}

func PermissionStrings(role Role) []string {
	perms := rolePermissions[role]
	out := make([]string, 0, len(perms))
	for _, p := range perms {
		out = append(out, string(p))
	}
	return out
}

func RoleHasPermission(role Role, perm Permission) bool {
	for _, p := range rolePermissions[role] {
		if p == perm {
			return true
		}
	}
	return false
}
