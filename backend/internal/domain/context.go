package domain

import "context"

type competitionContextKey struct{}

// WithCompetitionID marks the request as scoped to a competition. Challenge
// visibility may use this to reveal hidden challenges bound to a live contest.
func WithCompetitionID(ctx context.Context, id uint) context.Context {
	if id == 0 {
		return ctx
	}
	return context.WithValue(ctx, competitionContextKey{}, id)
}

func CompetitionIDFromContext(ctx context.Context) uint {
	if ctx == nil {
		return 0
	}
	id, _ := ctx.Value(competitionContextKey{}).(uint)
	return id
}
