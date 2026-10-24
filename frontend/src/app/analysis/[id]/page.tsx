
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  API,
  apiFetch,
  emptyMetrics,
  formatMoney,
  formatNumber,
  type AIAdvisor,
  type Finding,
  type Metrics,
} from "@/lib/advisor";

type RecordData = Record<string, unknown>;

type AnalysisData = {
  id?: number;
  upload_id?: number;
  filename?: string;
  upload?: {
    filename?: string;
    row_count?: number;
  };
  message?: string;
  rows?: number;
  row_count?: number;
  metrics?: Metrics;
  findings?: Finding[];
  readiness?: unknown;
  data?: RecordData[];
  records?: RecordData[];
  ai_advisor?: AIAdvisor | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function unwrap(value: unknown): Record<string, unknown> {
  const root = asObject(value);
  const nested = asObject(root.data);

  return Object.keys(nested).length > 0 ? nested : root;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function AnalysisDetailContent() {
  const params = useParams<{ id: string }>();
  const uploadId = params.id;

  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [advisor, setAdvisor] = useState<AIAdvisor | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");

  const loadAnalysis = useCallback(async () => {
    if (!uploadId) return;

    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `${API}/api/uploads/${encodeURIComponent(uploadId)}`,
        { cache: "no-store" },
      );

      const json: unknown = await response.json();

      if (!response.ok) {
        const message = asObject(json).message;
        throw new Error(
          typeof message === "string"
            ? message
            : `Gagal mengambil analisis (HTTP ${response.status}).`,
        );
      }

      const result = unwrap(json) as AnalysisData;
      setAnalysis(result);
      setAdvisor(result.ai_advisor ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil hasil analisis.",
      );
    } finally {
      setLoading(false);
    }
  }, [uploadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalysis();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAnalysis]);

  async function runAIAnalysis() {
    if (!uploadId) return;

    setAnalyzing(true);
    setAiError("");
    setAdvisor(null);

    try {
      const response = await apiFetch(`${API}/api/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: Number(uploadId) }),
      });

      const json: unknown = await response.json();

      if (!response.ok) {
        const message = asObject(json).message;
        throw new Error(
          typeof message === "string"
            ? message
            : `Analisis AI gagal (HTTP ${response.status}).`,
        );
      }

      const result = asObject(json).ai_advisor;
      if (!result || typeof result !== "object") {
        throw new Error("Respons AI tidak berisi hasil analisis.");
      }
      const advisorResult = result as AIAdvisor;
      setAdvisor(advisorResult);
      setAnalysis((current) =>
        current ? { ...current, ai_advisor: advisorResult } : current,
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "Analisis AI gagal dijalankan.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const metrics = analysis?.metrics ?? emptyMetrics;
  const findings = analysis?.findings ?? [];
  const records = analysis?.records ?? analysis?.data ?? [];
  const rowCount =
    analysis?.rows ??
    analysis?.row_count ??
    analysis?.upload?.row_count ??
    records.length;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6 lg:p-10">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
        <div className="h-8 w-72 animate-pulse rounded bg-slate-100" />
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="mx-auto max-w-3xl p-6 lg:p-10">
        <Link
          href="/history"
          className="text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          ← Kembali ke riwayat
        </Link>

        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-900">
            Hasil analisis tidak dapat dimuat
          </h1>

          <p className="mt-2 text-sm text-red-800">
            {error || "Data tidak ditemukan."}
          </p>

          <button
            onClick={() => void loadAnalysis()}
            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Impressions",
      value: formatNumber(metrics.total_impressions, 0),
    },
    {
      label: "Clicks",
      value: formatNumber(metrics.total_clicks, 0),
    },
    {
      label: "Total Spend",
      value: formatMoney(metrics.total_spend),
    },
    {
      label: "Conversions",
      value: formatNumber(metrics.total_conversions, 0),
    },
    {
      label: "CTR",
      value: metrics.ctr == null ? "—" : `${formatNumber(metrics.ctr)}%`,
    },
    {
      label: "CPA",
      value: formatMoney(metrics.cpa),
    },
    {
      label: "ROAS",
      value: metrics.roas == null ? "—" : `${formatNumber(metrics.roas)}x`,
    },
    {
      label: "Conversion Value",
      value: formatMoney(metrics.total_conversion_value),
    },
  ];

  const recordColumns = records.length > 0
    ? Object.keys(records[0])
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
      {/* Page heading */}
      <div>
        <Link
          href="/history"
          className="text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          ← Riwayat analisis
        </Link>

        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Analysis detail · #{uploadId}
            </p>

            <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-slate-950">
              {analysis.filename ||
                analysis.upload?.filename ||
                `Upload #${uploadId}`}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {formatNumber(rowCount, 0)} baris data · Ringkasan performa
              kampanye
            </p>
          </div>

          <button
            onClick={() => void runAIAnalysis()}
            disabled={analyzing}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analyzing ? "Menganalisis..." : "Jalankan AI Advisor"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Performance overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ringkasan metrik yang dihitung dari dataset.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">
                {kpi.label}
              </p>
              <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-950">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Automated findings */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Automated findings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Temuan berdasarkan aturan analisis backend.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {findings.length} temuan
          </span>
        </div>

        {findings.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Belum ada temuan yang dikembalikan untuk dataset ini.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {findings.map((finding, index) => (
              <article
                key={`${finding.code}-${index}`}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                    {finding.severity || "Info"}
                  </span>
                  <h3 className="font-semibold text-slate-900">
                    {finding.title}
                  </h3>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {finding.description}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* AI Advisor */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">AI Advisor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Insight dan rekomendasi eksperimen dari endpoint AI.
          </p>
        </div>

        {aiError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {aiError}
          </p>
        )}

        {!advisor && !aiError && (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="font-medium text-slate-800">
              AI Advisor belum dijalankan
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Pilih “Jalankan AI Advisor” untuk meminta analisis terhadap
              dataset ini.
            </p>
          </div>
        )}

        {advisor && (
          <div className="mt-5 space-y-6">
            <div className="rounded-xl bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                Summary
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-800">
                {advisor.summary || "Tidak ada ringkasan."}
              </p>
              {advisor.model && (
                <p className="mt-3 text-xs text-slate-500">
                  Model: {advisor.model}
                </p>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="font-semibold text-slate-900">Key insights</h3>
                {advisor.insights?.length ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                    {advisor.insights.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Tidak ada insight.
                  </p>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">Hypotheses</h3>
                {advisor.hypotheses?.length ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                    {advisor.hypotheses.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Tidak ada hipotesis.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                Recommended experiments
              </h3>

              {advisor.recommended_experiments?.length ? (
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  {advisor.recommended_experiments.map((experiment, index) => (
                    <article
                      key={`${experiment.name}-${index}`}
                      className="rounded-xl border border-slate-200 p-5"
                    >
                      <h4 className="font-semibold text-slate-900">
                        {experiment.name}
                      </h4>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {experiment.hypothesis}
                      </p>

                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="font-medium text-slate-500">
                            Variable
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {experiment.variable || "—"}
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-500">
                            Success metric
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {experiment.success_metric || "—"}
                          </dd>
                        </div>

                        <div>
                          <dt className="font-medium text-slate-500">
                            Recommended action
                          </dt>
                          <dd className="mt-1 text-slate-800">
                            {experiment.recommended_action || "—"}
                          </dd>
                        </div>
                      </dl>

                      {!!experiment.limitations?.length && (
                        <ul className="mt-3 list-disc pl-5 text-xs leading-5 text-slate-500">
                          {experiment.limitations.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Belum ada rekomendasi eksperimen.
                </p>
              )}
            </div>

            {advisor.disclaimer && (
              <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                {advisor.disclaimer}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Campaign records */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Campaign records
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Pratinjau baris yang dikembalikan oleh API.
        </p>

        {!records.length ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            API tidak mengembalikan baris data untuk pratinjau.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {recordColumns.map((key) => (
                    <th
                      key={key}
                      className="whitespace-nowrap px-4 py-3 font-semibold"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {records.slice(0, 10).map((record, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    {recordColumns.map((key) => (
                      <td
                        key={key}
                        className="max-w-xs truncate px-4 py-3 text-slate-700"
                      >
                        {displayValue(record[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {records.length > 10 && (
          <p className="mt-3 text-xs text-slate-500">
            Menampilkan 10 dari {records.length} baris.
          </p>
        )}
      </section>

      {/* Navigation */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/uploads/new"
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Upload dataset lain
        </Link>

        <Link
          href="/history"
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Lihat riwayat
        </Link>
      </div>
    </div>
  );
}

export default function AnalysisDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl animate-pulse space-y-4 p-6 lg:p-10">
          <div className="h-8 w-64 rounded bg-slate-100" />
          <div className="h-32 rounded-2xl bg-slate-100" />
        </div>
      }
    >
      <AnalysisDetailContent />
    </Suspense>
  );
}
