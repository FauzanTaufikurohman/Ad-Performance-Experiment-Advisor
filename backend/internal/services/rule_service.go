package services

import (
	"fmt"

	"github.com/FauzanTaufikurohman/ad-performance-advisor/backend/internal/models"
)

func AnalyzePerformance(
	records []models.AdRecord,
	metrics models.MetricSummary,
) []models.Finding {
	findings := make([]models.Finding, 0)

	if len(records) == 0 {
		return append(findings, models.Finding{
			Code:           "NO_DATA",
			Severity:       "warning",
			Title:          "Data belum tersedia",
			Description:    "Tidak ada record yang dapat dianalisis.",
			Recommendation: "Unggah CSV dengan baris data yang valid.",
		})
	}

	if metrics.TotalImpressions == 0 {
		findings = append(findings, models.Finding{
			Code:           "ZERO_IMPRESSIONS",
			Severity:       "warning",
			Title:          "Impresi belum tersedia",
			Description:    "Total impresi adalah nol sehingga CTR tidak dapat dihitung.",
			Recommendation: "Periksa rentang tanggal, status kampanye, dan kelengkapan ekspor data.",
		})
	}

	if metrics.TotalImpressions > 0 && metrics.TotalClicks == 0 {
		findings = append(findings, models.Finding{
			Code:           "ZERO_CLICKS",
			Severity:       "warning",
			Title:          "Belum ada klik",
			Description:    "Data memiliki impresi, tetapi belum mencatat klik.",
			Recommendation: "Periksa relevansi materi iklan, audiends, penempatan, dan tujuan kampanye sebelum mengambil tindakan.",
		})
	}

	if metrics.TotalSpend > 0 && metrics.TotalConversions == 0 {
		findings = append(findings, models.Finding{
			Code:           "SPEND_WITHOUT_CONVERSIONS",
			Severity:       "warning",
			Title:          "Biaya tercatat tanpa konversi",
			Description:    "Ada pengeluaran, tetapi jumlah konversio yang tercatat adalah nol.",
			Recommendation: "Periksa pelacakan konversi, periode atribusi, dan halaman tujuan. Jangan menyimpulkan iklan gagal sebelum validasi tersebut.",
		})
	}

	if metrics.TotalSpend == 0 {
		findings = append(findings, models.Finding{
			Code:           "ZERO_SPEND",
			Severity:       "info",
			Title:          "Biaya iklan nol",
			Description:    "ROAS tidak dapat dihitung karena total biaya adalah nol.",
			Recommendation: "Pastikan kolom biaya terisi dengan benar dan mata uang konsisten.",
		})
	}

	if metrics.TotalImpressions > 0 && metrics.TotalClicks > 0 && metrics.CTR != nil {
		findings = append(findings, models.Finding{
			Code:     "CTR_AVAILABLE",
			Severity: "info",
			Title:    "CTR berhasil dihitung",
			Description: fmt.Sprintf(
				"CTR agregat pada data yang diunggah adalah %.2f%%.",
				*metrics.CTR,
			),
			Recommendation: "Bandingkan dengan target kampanye atau peiode historis yang sebanding sebelum menilai performa.",
		})
	}

	if len(findings) == 0 {
		findings = append(findings, models.Finding{
			Code:           "NO_RULE_TRIGGERED",
			Severity:       "info",
			Title:          "Tidak ada kondisi khusus terdeteksi",
			Description:    "Aturan diagnostik dasar tidak menemukan kondisi yang perlu ditandai.",
			Recommendation: "Tinjau metrik dan konteks bisnis sebelum menentukan tindakan.",
		})
	}

	return findings
}
