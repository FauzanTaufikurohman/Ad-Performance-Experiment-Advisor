package models

type ReadinessCheck struct {
	Code    string `json:"code"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type ExperimentReadiness struct {
	Status            string           `json:"status"`
	Summary           string           `json:"summary"`
	RowCount          int              `json:"row_count"`
	StartDate         string           `json:"start_date"`
	EndDate           string           `json:"end_date"`
	EligibleForReview bool             `json:"eligible_for_review"`
	Checks            []ReadinessCheck `json:"checks"`
	Limitations       []string         `json:"limitations"`
}
