package services

import (
	"context"
	"errors"
	"testing"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

func TestEvaluateBayesianExperimentFindsClearCTRWinner(t *testing.T) {
	request := models.BayesianExperimentRequest{
		ExperimentID: "campaign-1",
		Metric:       models.BayesianMetricCTR,
		Arms: []models.BayesianExperimentArm{
			{Name: "control", Impressions: 10000, Clicks: 500, Conversions: 50},
			{Name: "variant", Impressions: 10000, Clicks: 1500, Conversions: 150},
		},
	}

	result, err := evaluateBayesianExperiment(context.Background(), request, 17)
	if err != nil {
		t.Fatalf("evaluateBayesianExperiment() error = %v", err)
	}
	if result.Winner != "variant" {
		t.Fatalf("Winner = %q, want variant", result.Winner)
	}
	if result.Arms[1].ProbabilityToBeBest < 0.99 {
		t.Fatalf(
			"variant probability to be best = %f, want >= 0.99",
			result.Arms[1].ProbabilityToBeBest,
		)
	}
	if result.BudgetAllocationPct["variant"] != 100 {
		t.Fatalf("variant allocation = %v, want 100%%", result.BudgetAllocationPct)
	}
}

func TestEvaluateBayesianExperimentReturnsBothPosteriorsAndColdStart(t *testing.T) {
	request := models.BayesianExperimentRequest{
		ExperimentID: "cold-start",
		Metric:       models.BayesianMetricCVR,
		Arms: []models.BayesianExperimentArm{
			{Name: "a", Impressions: 50, Clicks: 5, Conversions: 1},
			{Name: "b", Impressions: 60, Clicks: 6, Conversions: 0},
		},
	}

	result, err := evaluateBayesianExperiment(context.Background(), request, 23)
	if err != nil {
		t.Fatalf("evaluateBayesianExperiment() error = %v", err)
	}
	if result.Status != "insufficient_data" {
		t.Fatalf("Status = %q, want insufficient_data", result.Status)
	}
	if len(result.BudgetAllocationPct) != 0 || result.Winner != "" {
		t.Fatalf("cold-start result should not allocate a winner: %+v", result)
	}
	if got := result.Arms[0].PosteriorCTR; got.Alpha != 6 || got.Beta != 46 {
		t.Errorf("PosteriorCTR = %+v, want alpha 6 beta 46", got)
	}
	if got := result.Arms[0].PosteriorCVR; got.Alpha != 2 || got.Beta != 5 {
		t.Errorf("PosteriorCVR = %+v, want alpha 2 beta 5", got)
	}
}

func TestEvaluateBayesianExperimentSplitsBudgetForNearTie(t *testing.T) {
	request := models.BayesianExperimentRequest{
		ExperimentID: "tie",
		Metric:       models.BayesianMetricCTR,
		Arms: []models.BayesianExperimentArm{
			{Name: "a", Impressions: 1000, Clicks: 100, Conversions: 10},
			{Name: "b", Impressions: 1000, Clicks: 100, Conversions: 10},
		},
	}

	result, err := evaluateBayesianExperiment(context.Background(), request, 31)
	if err != nil {
		t.Fatalf("evaluateBayesianExperiment() error = %v", err)
	}
	if !result.Tied {
		t.Fatal("identical arms should be treated as a near tie")
	}
	if result.BudgetAllocationPct["a"] != 50 || result.BudgetAllocationPct["b"] != 50 {
		t.Fatalf("allocation = %v, want 50/50", result.BudgetAllocationPct)
	}
}

func TestEvaluateBayesianExperimentRejectsInvalidCounts(t *testing.T) {
	request := models.BayesianExperimentRequest{
		ExperimentID: "invalid",
		Metric:       models.BayesianMetricCTR,
		Arms: []models.BayesianExperimentArm{
			{Name: "a", Impressions: 10, Clicks: 11},
			{Name: "b", Impressions: 10},
		},
	}

	if _, err := EvaluateBayesianExperiment(context.Background(), request); err == nil {
		t.Fatal("expected invalid clicks to be rejected")
	}
}

func TestEvaluateBayesianExperimentHonorsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	request := models.BayesianExperimentRequest{
		ExperimentID: "cancelled",
		Metric:       models.BayesianMetricCTR,
		Arms: []models.BayesianExperimentArm{
			{Name: "a", Impressions: 1000, Clicks: 100},
			{Name: "b", Impressions: 1000, Clicks: 101},
		},
	}

	if _, err := evaluateBayesianExperiment(ctx, request, 41); !errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v, want context.Canceled", err)
	}
}

func TestFatigueRequiresThreeConsecutivePosteriorMeanDeclines(t *testing.T) {
	daily := []models.BayesianDailyMetric{
		{Date: "2026-10-04", Impressions: 1000, Clicks: 50},
		{Date: "2026-10-01", Impressions: 1000, Clicks: 200},
		{Date: "2026-10-03", Impressions: 1000, Clicks: 100},
		{Date: "2026-10-02", Impressions: 1000, Clicks: 150},
	}
	if !hasThreeDayPosteriorCTRDecline(daily) {
		t.Fatal("expected fatigue after three consecutive declining days")
	}

	daily[2].Date = "2026-10-05"
	if hasThreeDayPosteriorCTRDecline(daily) {
		t.Fatal("a missing calendar day should break a consecutive decline")
	}
}

func BenchmarkEvaluateBayesianExperiment10k(b *testing.B) {
	request := models.BayesianExperimentRequest{
		ExperimentID: "benchmark",
		Metric:       models.BayesianMetricCTR,
		Arms: []models.BayesianExperimentArm{
			{Name: "a", Impressions: 10000, Clicks: 500},
			{Name: "b", Impressions: 10000, Clicks: 550},
			{Name: "c", Impressions: 10000, Clicks: 600},
			{Name: "d", Impressions: 10000, Clicks: 650},
			{Name: "e", Impressions: 10000, Clicks: 700},
			{Name: "f", Impressions: 10000, Clicks: 750},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := EvaluateBayesianExperiment(context.Background(), request); err != nil {
			b.Fatal(err)
		}
	}
}
