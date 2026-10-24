package models

type Finding struct {
	Code           string `json:"code"`
	Severity       string `json:"severity"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	Recommendation string `json:"recommendation"`
}
