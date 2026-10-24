package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/responses"
)

type aiInput struct {
	Metrics  models.MetricSummary `json:"metrics"`
	Findings []models.Finding     `json:"findings"`
}

func GenerateAIAdvisor(
	ctx context.Context,
	metrics models.MetricSummary,
	findings []models.Finding,
) (models.AIAdvisorResponse, error) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return models.AIAdvisorResponse{}, errors.New(
			"OPENAI_API_KEY belum dikonfigurasi di backend",
		)
	}

	model := strings.TrimSpace(os.Getenv("OPENAI_MODEL"))
	if model == "" {
		model = "gpt-4.1-mini"
	}

	timeoutSeconds := 30
	if value := strings.TrimSpace(os.Getenv("OPENAI_TIMEOUT_SECONDS")); value != "" {
		var configured int
		if _, err := fmt.Sscanf(value, "%d", &configured); err == nil && configured > 0 {
			timeoutSeconds = configured
		}
	}

	requestCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	input := aiInput{
		Metrics:  metrics,
		Findings: findings,
	}

	inputJSON, err := json.Marshal(input)
	if err != nil {
		return models.AIAdvisorResponse{}, fmt.Errorf("gagal menyiapkan input AI: %w", err)
	}

	prompt := `You are an advertising performance analyst.
Analyze only the supplied aggregate metrics and rule-based findings.

Return ONLY one valid JSON object with this exact structure:
{
  "status": "success",
  "summary": "short summary",
  "insights": ["evidence-based insight"],
  "hypotheses": ["possible explanation clearly labeled as a hypothesis"],
  "recommended_experiments": [
    {
      "name": "experiment name",
      "hypothesis": "testable hypothesis",
      "variable": "one variable to test",
      "success_metric": "metric to monitor",
      "recommended_action": "practical next step",
      "limitations": ["missing information or caveat"]
    }
  ],
  "disclaimer": "brief statement that recommendations require human review"
}

Rules:
- Do not invent data, benchmarks, campaign details, or causes.
- Use only the supplied metrics and findings.
- Clearly distinguish observations from hypotheses.
- Do not claim an experiment will definitely improve performance.
- If the data is insufficient, say so and recommend collecting more data.
- Never recommend changing budgets automatically.
- Keep the answer concise and write in Indonesian.
- Return 1 to 5 insights, 1 to 3 hypotheses, and 1 to 3 experiments.
- All fields shown in the JSON structure are required.
- Do not wrap the JSON in Markdown fences.

Input data:
` + string(inputJSON)

	client := openai.NewClient(
	// The SDK also reads OPENAI_API_KEY from the environment by default.
	// Passing the key explicitly keeps the source clear and server-side.
	)

	response, err := client.Responses.New(
		requestCtx,
		responses.ResponseNewParams{
			Model: model,
			Input: responses.ResponseNewParamsInputUnion{
				OfString: openai.String(prompt),
			},
		},
	)
	if err != nil {
		return models.AIAdvisorResponse{}, fmt.Errorf("permintaan OpenAI gagal: %w", err)
	}

	output := strings.TrimSpace(response.OutputText())
	if output == "" {
		return models.AIAdvisorResponse{}, errors.New("OpenAI mengembalikan respons kosong")
	}

	// Tolerate accidental Markdown fences, but still require valid JSON.
	output = strings.TrimPrefix(output, "```json")
	output = strings.TrimPrefix(output, "```")
	output = strings.TrimSuffix(output, "```")
	output = strings.TrimSpace(output)

	var result models.AIAdvisorResponse
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		return models.AIAdvisorResponse{}, fmt.Errorf("format respons AI tidak valid: %w", err)
	}

	if strings.TrimSpace(result.Summary) == "" ||
		len(result.Insights) == 0 ||
		len(result.Hypotheses) == 0 ||
		len(result.RecommendedExperiments) == 0 {
		return models.AIAdvisorResponse{}, errors.New(
			"respons AI tidak memenuhi struktur yang diwajibkan",
		)
	}

	result.Status = "success"
	result.Model = model

	return result, nil
}
