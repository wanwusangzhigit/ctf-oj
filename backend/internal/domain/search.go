package domain

type SearchHit struct {
	Type     string `json:"type"` // challenge | user | team | announcement
	ID       uint   `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle,omitempty"`
}
