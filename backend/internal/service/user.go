package service

import (
	"context"

	"github.com/ctf-oj/backend/internal/domain"
)

type UserService struct {
	users  domain.UserRepository
	solves domain.SolveRepository
}

func NewUserService(u domain.UserRepository, s domain.SolveRepository) *UserService {
	return &UserService{users: u, solves: s}
}

func (s *UserService) Get(ctx context.Context, id uint) (*domain.User, error) {
	return s.users.FindByID(ctx, id)
}

func (s *UserService) List(ctx context.Context, page, pageSize int) ([]*domain.User, int64, error) {
	return s.users.List(ctx, page, pageSize)
}

func (s *UserService) MySolves(ctx context.Context, userID uint) ([]*domain.Solve, error) {
	return s.solves.ListByUser(ctx, userID)
}

func (s *UserService) Scoreboard(ctx context.Context, page, pageSize int) ([]*domain.User, int64, error) {
	return s.solves.ListScoreboard(ctx, page, pageSize)
}

func (s *UserService) Update(ctx context.Context, u *domain.User) error {
	return s.users.Update(ctx, u)
}
