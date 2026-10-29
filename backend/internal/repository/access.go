package repository

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"github.com/ctf-oj/backend/internal/domain"
)

type accessRepo struct {
	db *gorm.DB
}

func NewChallengeAccessRepository(db *gorm.DB) domain.ChallengeAccessRepository {
	return &accessRepo{db: db}
}

func NewCommunityAccessRepository(db *gorm.DB) domain.CommunityAccessRepository {
	return &accessRepo{db: db}
}

func (r *accessRepo) ListGroups(ctx context.Context) ([]*domain.ChallengeGroup, error) {
	var gs []*domain.ChallengeGroup
	if err := r.db.WithContext(ctx).
		Preload("Members").
		Order("name ASC").
		Find(&gs).Error; err != nil {
		return nil, err
	}
	return gs, nil
}

func (r *accessRepo) FindGroupByID(ctx context.Context, id uint) (*domain.ChallengeGroup, error) {
	var g domain.ChallengeGroup
	if err := r.db.WithContext(ctx).
		Preload("Members").
		First(&g, id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &g, nil
}

func (r *accessRepo) FindGroupByName(ctx context.Context, name string) (*domain.ChallengeGroup, error) {
	var g domain.ChallengeGroup
	if err := r.db.WithContext(ctx).
		Where("name = ?", name).
		First(&g).Error; err != nil {
		return nil, mapErr(err)
	}
	return &g, nil
}

func (r *accessRepo) CreateGroup(ctx context.Context, g *domain.ChallengeGroup) error {
	return mapErr(r.db.WithContext(ctx).Create(g).Error)
}

func (r *accessRepo) UpdateGroup(ctx context.Context, g *domain.ChallengeGroup) error {
	return mapErr(r.db.WithContext(ctx).Save(g).Error)
}

func (r *accessRepo) DeleteGroup(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("subject_type = ? AND subject_id = ?", domain.SubjectGroup, id).
			Delete(&domain.ChallengeAccessGrant{}).Error; err != nil {
			return err
		}
		if err := tx.Where("subject_type = ? AND subject_id = ?", domain.SubjectGroup, id).
			Delete(&domain.CompetitionAccessGrant{}).Error; err != nil {
			return err
		}
		res := tx.Delete(&domain.ChallengeGroup{}, id)
		if res.Error != nil {
			return mapErr(res.Error)
		}
		if res.RowsAffected == 0 {
			return domain.ErrNotFound
		}
		return nil
	})
}

func (r *accessRepo) ReplaceGroupMembers(ctx context.Context, groupID uint, members []domain.ChallengeGroupMember) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("group_id = ?", groupID).Delete(&domain.ChallengeGroupMember{}).Error; err != nil {
			return err
		}
		for _, m := range members {
			m.GroupID = groupID
			if err := tx.Create(&m).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *accessRepo) ListGrants(ctx context.Context, challengeID uint) ([]*domain.ChallengeAccessGrant, error) {
	var gs []*domain.ChallengeAccessGrant
	if err := r.db.WithContext(ctx).
		Where("challenge_id = ?", challengeID).
		Order("subject_type ASC, subject_id ASC").
		Find(&gs).Error; err != nil {
		return nil, err
	}
	return gs, nil
}

func (r *accessRepo) ReplaceGrants(ctx context.Context, challengeID uint, grants []domain.ChallengeAccessGrant) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("challenge_id = ?", challengeID).Delete(&domain.ChallengeAccessGrant{}).Error; err != nil {
			return err
		}
		for _, g := range grants {
			g.ChallengeID = challengeID
			if err := tx.Create(&g).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *accessRepo) HasAccess(ctx context.Context, challengeID, userID, teamID uint) (bool, error) {
	level, err := r.AccessLevel(ctx, challengeID, userID, teamID)
	return level != "", err
}

func (r *accessRepo) AccessLevel(ctx context.Context, challengeID, userID, teamID uint) (domain.AccessPermission, error) {
	return r.accessLevel(ctx, "challenge_access_grants", "challenge_id", challengeID, userID, teamID)
}

func (r *accessRepo) CompetitionAccessLevel(ctx context.Context, competitionID, userID, teamID uint) (domain.AccessPermission, error) {
	return r.accessLevel(ctx, "competition_access_grants", "competition_id", competitionID, userID, teamID)
}

func (r *accessRepo) accessLevel(ctx context.Context, table, resourceColumn string, resourceID, userID, teamID uint) (domain.AccessPermission, error) {
	if userID == 0 && teamID == 0 {
		return "", nil
	}
	var rows []struct {
		Permission string
	}
	err := r.db.WithContext(ctx).Raw(`
		SELECT g.permission FROM `+table+` g
		WHERE g.`+resourceColumn+` = ?
		  AND (
			(g.subject_type = 'user' AND g.subject_id = ?)
			OR (g.subject_type = 'team' AND g.subject_id = ?)
			OR (g.subject_type = 'group' AND g.subject_id IN (
				SELECT m.group_id FROM challenge_group_members m
				WHERE (m.subject_type = 'user' AND m.subject_id = ?)
				   OR (m.subject_type = 'team' AND m.subject_id = ?)
			))
		  )`, resourceID, userID, teamID, userID, teamID).Scan(&rows).Error
	if err != nil {
		return "", err
	}
	for _, row := range rows {
		if domain.AccessPermission(row.Permission) == domain.AccessManage {
			return domain.AccessManage, nil
		}
	}
	if len(rows) > 0 {
		return domain.AccessView, nil
	}
	return "", nil
}

func (r *accessRepo) CommunityAccessLevel(ctx context.Context, userID, teamID uint) (domain.AccessPermission, error) {
	if userID == 0 && teamID == 0 {
		return "", nil
	}
	var rows []struct {
		Permission string
	}
	err := r.db.WithContext(ctx).Raw(`
		SELECT g.permission FROM community_access_grants g
		WHERE (
			(g.subject_type = 'user' AND g.subject_id = ?)
			OR (g.subject_type = 'team' AND g.subject_id = ?)
			OR (g.subject_type = 'group' AND g.subject_id IN (
				SELECT m.group_id FROM challenge_group_members m
				WHERE (m.subject_type = 'user' AND m.subject_id = ?)
				   OR (m.subject_type = 'team' AND m.subject_id = ?)
			))
		)`, userID, teamID, userID, teamID).Scan(&rows).Error
	if err != nil {
		return "", err
	}
	for _, row := range rows {
		if domain.AccessPermission(row.Permission) == domain.AccessManage {
			return domain.AccessManage, nil
		}
	}
	if len(rows) > 0 {
		return domain.AccessView, nil
	}
	return "", nil
}

func (r *accessRepo) ListCommunityGrants(ctx context.Context) ([]*domain.CommunityAccessGrant, error) {
	var gs []*domain.CommunityAccessGrant
	if err := r.db.WithContext(ctx).
		Order("subject_type ASC, subject_id ASC").
		Find(&gs).Error; err != nil {
		return nil, err
	}
	return gs, nil
}

func (r *accessRepo) ReplaceCommunityGrants(ctx context.Context, grants []domain.CommunityAccessGrant) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("1 = 1").Delete(&domain.CommunityAccessGrant{}).Error; err != nil {
			return err
		}
		for _, g := range grants {
			if err := tx.Create(&g).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *accessRepo) ListCompetitionGrants(ctx context.Context, competitionID uint) ([]*domain.CompetitionAccessGrant, error) {
	var gs []*domain.CompetitionAccessGrant
	if err := r.db.WithContext(ctx).
		Where("competition_id = ?", competitionID).
		Order("subject_type ASC, subject_id ASC").
		Find(&gs).Error; err != nil {
		return nil, err
	}
	return gs, nil
}

func (r *accessRepo) ReplaceCompetitionGrants(ctx context.Context, competitionID uint, grants []domain.CompetitionAccessGrant) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("competition_id = ?", competitionID).Delete(&domain.CompetitionAccessGrant{}).Error; err != nil {
			return err
		}
		for _, g := range grants {
			g.CompetitionID = competitionID
			if err := tx.Create(&g).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *accessRepo) ManagedCompetitionIDs(ctx context.Context, userID, teamID uint) ([]uint, error) {
	if userID == 0 && teamID == 0 {
		return nil, nil
	}
	var rows []struct {
		CompetitionID uint
	}
	err := r.db.WithContext(ctx).Raw(`
		SELECT DISTINCT g.competition_id FROM competition_access_grants g
		WHERE g.permission = 'manage'
		  AND (
			(g.subject_type = 'user' AND g.subject_id = ?)
			OR (g.subject_type = 'team' AND g.subject_id = ?)
			OR (g.subject_type = 'group' AND g.subject_id IN (
				SELECT m.group_id FROM challenge_group_members m
				WHERE (m.subject_type = 'user' AND m.subject_id = ?)
				   OR (m.subject_type = 'team' AND m.subject_id = ?)
			))
		  )`, userID, teamID, userID, teamID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	ids := make([]uint, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.CompetitionID)
	}
	return ids, nil
}

func (r *accessRepo) ListDelegations(ctx context.Context, userID, teamID uint) ([]domain.Delegation, error) {
	if userID == 0 && teamID == 0 {
		return nil, nil
	}
	var out []domain.Delegation
	err := r.db.WithContext(ctx).Raw(`
		SELECT 'challenge' AS resource_type, g.challenge_id AS resource_id,
		       c.title AS name, g.permission
		FROM challenge_access_grants g
		JOIN challenges c ON c.id = g.challenge_id
		WHERE (
			(g.subject_type = 'user' AND g.subject_id = ?)
			OR (g.subject_type = 'team' AND g.subject_id = ?)
			OR (g.subject_type = 'group' AND g.subject_id IN (
				SELECT m.group_id FROM challenge_group_members m
				WHERE (m.subject_type = 'user' AND m.subject_id = ?)
				   OR (m.subject_type = 'team' AND m.subject_id = ?)
			))
		)
		UNION ALL
		SELECT 'competition' AS resource_type, g.competition_id AS resource_id,
		       c.name AS name, g.permission
		FROM competition_access_grants g
		JOIN competitions c ON c.id = g.competition_id
		WHERE (
			(g.subject_type = 'user' AND g.subject_id = ?)
			OR (g.subject_type = 'team' AND g.subject_id = ?)
			OR (g.subject_type = 'group' AND g.subject_id IN (
				SELECT m.group_id FROM challenge_group_members m
				WHERE (m.subject_type = 'user' AND m.subject_id = ?)
				   OR (m.subject_type = 'team' AND m.subject_id = ?)
			))
		)
		ORDER BY resource_type ASC, resource_id ASC`,
		userID, teamID, userID, teamID,
		userID, teamID, userID, teamID,
	).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *accessRepo) SearchSubjects(ctx context.Context, subjectType domain.AccessSubjectType, query string, limit int) ([]domain.AccessSubject, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}
	q := strings.TrimSpace(query)
	out := make([]domain.AccessSubject, 0, limit)
	switch subjectType {
	case domain.SubjectUser:
		dbq := r.db.WithContext(ctx).Model(&domain.User{}).
			Select("id, username AS name").
			Where("is_banned = ?", false)
		if q != "" {
			like := "%" + strings.ToLower(q) + "%"
			dbq = dbq.Where("LOWER(username) LIKE ? OR LOWER(email) LIKE ?", like, like)
		}
		var rows []struct {
			ID   uint
			Name string
		}
		if err := dbq.Order("id ASC").Limit(limit).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			out = append(out, domain.AccessSubject{Type: string(domain.SubjectUser), ID: row.ID, Name: row.Name})
		}
	case domain.SubjectTeam:
		dbq := r.db.WithContext(ctx).Model(&domain.Team{}).Select("id, name")
		if q != "" {
			like := "%" + strings.ToLower(q) + "%"
			dbq = dbq.Where("LOWER(name) LIKE ? OR LOWER(slug) LIKE ?", like, like)
		}
		var rows []struct {
			ID   uint
			Name string
		}
		if err := dbq.Order("id ASC").Limit(limit).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			out = append(out, domain.AccessSubject{Type: string(domain.SubjectTeam), ID: row.ID, Name: row.Name})
		}
	}
	return out, nil
}
