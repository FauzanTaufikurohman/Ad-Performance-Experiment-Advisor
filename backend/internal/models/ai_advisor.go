package models

type AIExperiment struct {
	Name              string   `json:"name"`
	Hypothesis        string   `json:"hypothesis"`
	Variable          string   `json:"variable"`
	SuccessMetric     string   `json:"success_metric"`
	RecommendedAction string   `json:"recommended_action"`
	Limitations       []string `json:"limitations"`
}

type AIAdvisorResponse struct {
	Status                 string         `json:"status"`
	Model                  string         `json:"model,omitempty"`
	Summary                string         `json:"summary"`
	Insights               []string       `json:"insights"`
	Hypotheses             []string       `json:"hypotheses"`
	RecommendedExperiments []AIExperiment `json:"recommended_experiments"`
	Disclaimer             string         `json:"disclaimer"`
}
