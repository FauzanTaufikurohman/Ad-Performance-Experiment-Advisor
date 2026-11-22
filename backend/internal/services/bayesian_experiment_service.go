package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"runtime"
	"sort"
	"strings"
	"sync/atomic"
	"time"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

const (
	bayesianIterations     = 10_000
	minimumColdStartViews  = 100
	minimumExperimentArms  = 2
	maximumExperimentArms  = 20
	bayesianTieLossCutoff  = 0.001
	maximumBayesianWorkers = 8
)

const MinimumMonteCarloArms = 6

var bayesianSeedCounter atomic.Uint64

type armPosterior struct {
	result models.BayesianArmResult
	alpha  float64
	beta   float64
}

type simulationResult struct {
	wins   []int
	losses []float64
}

func EvaluateBayesianExperiment(
	ctx context.Context,
	request models.BayesianExperimentRequest,
) (models.BayesianExperimentResult, error) {
	seed := time.Now().UnixNano() + int64(bayesianSeedCounter.Add(1))
	return evaluateBayesianExperiment(ctx, request, seed)
}

func evaluateBayesianExperiment(
	ctx context.Context,
	request models.BayesianExperimentRequest,
	seed int64,
) (models.BayesianExperimentResult, error) {
	if err := validateBayesianExperiment(request); err != nil {
		return models.BayesianExperimentResult{}, err
	}

	posteriors := make([]armPosterior, len(request.Arms))
	for i, arm := range request.Arms {
		ctr := models.BetaPosterior{
			Alpha: 1 + float64(arm.Clicks),
			Beta:  1 + float64(arm.Impressions-arm.Clicks),
		}
		cvr := models.BetaPosterior{
			Alpha: 1 + float64(arm.Conversions),
			Beta:  1 + float64(arm.Clicks-arm.Conversions),
		}
		selected := ctr
		if request.Metric == models.BayesianMetricCVR {
			selected = cvr
		}

		posteriors[i] = armPosterior{
			result: models.BayesianArmResult{
				Name:         strings.TrimSpace(arm.Name),
				Impressions:  arm.Impressions,
				Clicks:       arm.Clicks,
				Conversions:  arm.Conversions,
				PosteriorCTR: ctr,
				PosteriorCVR: cvr,
				ColdStart:    arm.Impressions < minimumColdStartViews,
				AdFatigued:   hasThreeDayPosteriorCTRDecline(arm.DailyMetrics),
			},
			alpha: selected.Alpha,
			beta:  selected.Beta,
		}
	}

	simulated, err := simulatePosteriors(ctx, posteriors, bayesianIterations, seed)
	if err != nil {
		return models.BayesianExperimentResult{}, err
	}

	result := models.BayesianExperimentResult{
		ExperimentID:        strings.TrimSpace(request.ExperimentID),
		Metric:              request.Metric,
		Status:              "evaluated",
		Iterations:          bayesianIterations,
		BudgetAllocationPct: make(map[string]float64),
		Arms:                make([]models.BayesianArmResult, len(posteriors)),
	}

	minimumLoss := math.Inf(1)
	for i := range posteriors {
		armResult := posteriors[i].result
		armResult.ProbabilityToBeBest = float64(simulated.wins[i]) / float64(bayesianIterations)
		armResult.ExpectedLoss = simulated.losses[i] / float64(bayesianIterations)
		result.Arms[i] = armResult
		if armResult.ExpectedLoss < minimumLoss {
			minimumLoss = armResult.ExpectedLoss
		}
		if armResult.ColdStart {
			result.Status = "insufficient_data"
		}
	}

	if result.Status == "insufficient_data" {
		return result, nil
	}

	tiedArms := make([]string, 0, len(result.Arms))
	for _, arm := range result.Arms {
		if arm.ExpectedLoss-minimumLoss <= bayesianTieLossCutoff {
			tiedArms = append(tiedArms, arm.Name)
		}
	}

	if len(tiedArms) > 1 {
		result.Tied = true
		allocation := 100 / float64(len(tiedArms))
		for _, name := range tiedArms {
			result.BudgetAllocationPct[name] = allocation
		}
		return result, nil
	}

	for _, arm := range result.Arms {
		if arm.ExpectedLoss == minimumLoss {
			result.Winner = arm.Name
			result.BudgetAllocationPct[arm.Name] = 100
			break
		}
	}

	return result, nil
}

func validateBayesianExperiment(request models.BayesianExperimentRequest) error {
	experimentID := strings.TrimSpace(request.ExperimentID)
	if experimentID == "" || len(experimentID) > 100 {
		return errors.New("experiment_id wajib diisi dan maksimal 100 karakter")
	}
	if request.Metric != models.BayesianMetricCTR && request.Metric != models.BayesianMetricCVR {
		return errors.New("metric harus bernilai ctr atau cvr")
	}
	if len(request.Arms) < minimumExperimentArms || len(request.Arms) > maximumExperimentArms {
		return fmt.Errorf(
			"jumlah arms harus antara %d dan %d",
			minimumExperimentArms,
			maximumExperimentArms,
		)
	}

	names := make(map[string]struct{}, len(request.Arms))
	for _, arm := range request.Arms {
		name := strings.TrimSpace(arm.Name)
		if name == "" || len(name) > 100 {
			return errors.New("nama arm wajib diisi dan maksimal 100 karakter")
		}
		if _, exists := names[name]; exists {
			return fmt.Errorf("nama arm %q tidak boleh duplikat", name)
		}
		names[name] = struct{}{}

		if arm.Impressions < 0 || arm.Clicks < 0 || arm.Conversions < 0 {
			return fmt.Errorf("arm %q memiliki jumlah metrik negatif", name)
		}
		if arm.Clicks > arm.Impressions || arm.Conversions > arm.Clicks {
			return fmt.Errorf(
				"arm %q harus memenuhi conversions <= clicks <= impressions",
				name,
			)
		}
		if len(arm.DailyMetrics) > 90 {
			return fmt.Errorf("arm %q maksimal memiliki 90 metrik harian", name)
		}

		dailyDates := make(map[string]struct{}, len(arm.DailyMetrics))
		for _, daily := range arm.DailyMetrics {
			if _, err := time.Parse("2006-01-02", daily.Date); err != nil {
				return fmt.Errorf("arm %q memiliki tanggal harian tidak valid", name)
			}
			if _, exists := dailyDates[daily.Date]; exists {
				return fmt.Errorf("arm %q memiliki tanggal harian duplikat", name)
			}
			dailyDates[daily.Date] = struct{}{}
			if daily.Impressions < 0 || daily.Clicks < 0 || daily.Clicks > daily.Impressions {
				return fmt.Errorf("arm %q memiliki metrik harian tidak valid", name)
			}
		}
	}

	return nil
}

type datedDailyMetric struct {
	date        time.Time
	impressions int64
	clicks      int64
}

func hasThreeDayPosteriorCTRDecline(dailyMetrics []models.BayesianDailyMetric) bool {
	if len(dailyMetrics) < 4 {
		return false
	}

	daily := make([]datedDailyMetric, len(dailyMetrics))
	for i, metric := range dailyMetrics {
		date, _ := time.Parse("2006-01-02", metric.Date)
		daily[i] = datedDailyMetric{
			date:        date,
			impressions: metric.Impressions,
			clicks:      metric.Clicks,
		}
	}
	sort.Slice(daily, func(i, j int) bool {
		return daily[i].date.Before(daily[j].date)
	})

	for end := 3; end < len(daily); end++ {
		window := daily[end-3 : end+1]
		consecutive := true
		declining := true
		previousMean := posteriorCTRMean(window[0])

		for i := 1; i < len(window); i++ {
			if !window[i-1].date.AddDate(0, 0, 1).Equal(window[i].date) {
				consecutive = false
				break
			}

			mean := posteriorCTRMean(window[i])
			if mean >= previousMean {
				declining = false
				break
			}
			previousMean = mean
		}

		if consecutive && declining {
			return true
		}
	}

	return false
}

func posteriorCTRMean(metric datedDailyMetric) float64 {
	return (1 + float64(metric.clicks)) / (2 + float64(metric.impressions))
}

func simulatePosteriors(
	ctx context.Context,
	posteriors []armPosterior,
	iterations int,
	seed int64,
) (simulationResult, error) {
	workers := min(runtime.GOMAXPROCS(0), maximumBayesianWorkers, iterations)
	results := make(chan simulationResult, workers)

	for worker := 0; worker < workers; worker++ {
		go func(worker int) {
			rng := rand.New(rand.NewSource(seed + int64(worker)))
			result := simulationResult{
				wins:   make([]int, len(posteriors)),
				losses: make([]float64, len(posteriors)),
			}
			draws := make([]float64, len(posteriors))

			for iteration := worker; iteration < iterations; iteration += workers {
				if iteration%256 == 0 {
					select {
					case <-ctx.Done():
						results <- result
						return
					default:
					}
				}

				best := 0
				for i, posterior := range posteriors {
					draws[i] = sampleBeta(rng, posterior.alpha, posterior.beta)
					if draws[i] > draws[best] {
						best = i
					}
				}

				result.wins[best]++
				bestDraw := draws[best]
				for i, draw := range draws {
					result.losses[i] += bestDraw - draw
				}
			}

			results <- result
		}(worker)
	}

	total := simulationResult{
		wins:   make([]int, len(posteriors)),
		losses: make([]float64, len(posteriors)),
	}
	for range workers {
		partial := <-results
		for i := range total.wins {
			total.wins[i] += partial.wins[i]
			total.losses[i] += partial.losses[i]
		}
	}
	if err := ctx.Err(); err != nil {
		return simulationResult{}, err
	}

	return total, nil
}

func sampleBeta(rng *rand.Rand, alpha, beta float64) float64 {
	left := sampleGamma(rng, alpha)
	right := sampleGamma(rng, beta)
	return left / (left + right)
}

func sampleGamma(rng *rand.Rand, shape float64) float64 {
	if shape < 1 {
		return sampleGamma(rng, shape+1) * math.Pow(rng.Float64(), 1/shape)
	}

	d := shape - 1.0/3.0
	c := 1 / math.Sqrt(9*d)
	for {
		normal := rng.NormFloat64()
		base := 1 + c*normal
		if base <= 0 {
			continue
		}

		cubed := base * base * base
		uniform := rng.Float64()
		if uniform < 1-0.0331*normal*normal*normal*normal ||
			math.Log(uniform) < 0.5*normal*normal+d*(1-cubed+math.Log(cubed)) {
			return d * cubed
		}
	}
}
