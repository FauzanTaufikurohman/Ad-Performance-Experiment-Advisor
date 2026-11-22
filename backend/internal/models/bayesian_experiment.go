package models

import "time"

const (
	BayesianMetricCTR = "ctr"
	BayesianMetricCVR = "cvr"
)

type BayesianExperimentRequest struct {
	ExperimentID string                  `json:"experiment_id"`
	Metric       string                  `json:"metric"`
	Arms         []BayesianExperimentArm `json:"arms"`
}

type BayesianExperimentArm struct {
	Name         string                `json:"name"`
	Impressions  int64                 `json:"impressions"`
	Clicks       int64                 `json:"clicks"`
	Conversions  int64                 `json:"conversions"`
	DailyMetrics []BayesianDailyMetric `json:"daily_metrics,omitempty"`
}

type BayesianDailyMetric struct {
	Date        string `json:"date"`
	Impressions int64  `json:"impressions"`
	Clicks      int64  `json:"clicks"`
}

type BetaPosterior struct {
	Alpha float64 `json:"alpha"`
	Beta  float64 `json:"beta"`
}

type BayesianArmResult struct {
	Name                string        `json:"name"`
	Impressions         int64         `json:"impressions"`
	Clicks              int64         `json:"clicks"`
	Conversions         int64         `json:"conversions"`
	PosteriorCTR        BetaPosterior `json:"posterior_ctr"`
	PosteriorCVR        BetaPosterior `json:"posterior_cvr"`
	ProbabilityToBeBest float64       `json:"probability_to_be_best"`
	ExpectedLoss        float64       `json:"expected_loss"`
	ColdStart           bool          `json:"cold_start"`
	AdFatigued          bool          `json:"ad_fatigued"`
}

type BayesianExperimentResult struct {
	ExperimentID        string              `json:"experiment_id"`
	Metric              string              `json:"metric"`
	Status              string              `json:"status"`
	Iterations          int                 `json:"iterations"`
	Winner              string              `json:"winner,omitempty"`
	Tied                bool                `json:"tied"`
	BudgetAllocationPct map[string]float64  `json:"budget_allocation_pct"`
	Arms                []BayesianArmResult `json:"arms"`
}

type BayesianExperimentRun struct {
	Result      BayesianExperimentResult `json:"result"`
	EvaluatedBy string                   `json:"evaluated_by"`
	EvaluatedAt time.Time                `json:"evaluated_at"`
}
