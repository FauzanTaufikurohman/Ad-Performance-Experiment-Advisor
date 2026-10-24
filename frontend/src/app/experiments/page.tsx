
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  API,
  apiFetch,
  type HistoryItem,
  type AIAdvisor,
} from "@/lib/advisor";

type UploadResponse = {
  success: boolean;
  message?: string;
  data?: HistoryItem[];
};

type AnalyzeResponse = {
  success: boolean;
  message?: string;
  ai_status?: string;
  ai_advisor?: AIAdvisor;
};

export default function ExperimentsPage() {
  const [uploads, setUploads] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [advisor, setAdvisor] = useState<AIAdvisor | null>(null);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUploads = useCallback(async () => {
    setLoadingUploads(true);
    setError("");

    try {
      const response = await apiFetch(
        `${API}/api/uploads?page=1&limit=10`,
        { cache: "no-store" }
      );

      const json: UploadResponse = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil daftar dataset."
        );
      }

      const items = Array.isArray(json.data) ? json.data : [];
      setUploads(items);

      setSelectedId((current) => {
        if (current && items.some((item) => String(item.id) === current)) {
          return current;
        }

        return items.length ? String(items[0].id) : "";
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Backend tidak dapat dihubungi."
      );
    } finally {
      setLoadingUploads(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUploads();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUploads]);

  const generateExperiments = async () => {
    if (!selectedId) {
      setError("Pilih dataset terlebih dahulu.");
      return;
    }

    setAnalyzing(true);
    setError("");
    setNotice("");
    setAdvisor(null);

    try {
      const response = await apiFetch(`${API}/api/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          upload_id: Number(selectedId),
        }),
      });

      const json: AnalyzeResponse = await response.json();

      if (!response.ok || !json.success || !json.ai_advisor) {
        throw new Error(
          json.message || "AI belum berhasil membuat rekomendasi."
        );
      }

      setAdvisor(json.ai_advisor);

      if (
        !json.ai_advisor.recommended_experiments?.length
      ) {
        setNotice(
          "Analisis berhasil, tetapi AI tidak mengembalikan rekomendasi eksperimen."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghasilkan rekomendasi eksperimen."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedUpload = uploads.find(
    (upload) => String(upload.id) === selectedId
  );

  const experiments = advisor?.recommended_experiments ?? [];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Workspace / Experiments
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Experiment Advisor
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Ubah temuan performa kampanye menjadi hipotesis
              dan rekomendasi eksperimen A/B yang dapat diuji.
            </p>
          </div>

          <Link
            href="/uploads/new"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            + Upload dataset
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>

            <div>
              <h2 className="font-semibold text-slate-950">
                Generate experiment recommendations
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Pilih dataset yang sudah diunggah. AI Advisor akan
                menganalisis data tersebut menggunakan endpoint backend.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="dataset"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Campaign dataset
              </label>

              <select
                id="dataset"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setAdvisor(null);
                  setError("");
                  setNotice("");
                }}
                disabled={loadingUploads || uploads.length === 0 || analyzing}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              >
                <option value="">
                  {loadingUploads
                    ? "Loading datasets..."
                    : uploads.length
                      ? "Pilih dataset"
                      : "Belum ada dataset"}
                </option>

                {uploads.map((upload) => (
                  <option key={upload.id} value={String(upload.id)}>
                    {upload.filename} — {upload.row_count} rows
                  </option>
                ))}
              </select>

              {selectedUpload && (
                <p className="mt-2 text-xs text-slate-500">
                  Dataset ID: {selectedUpload.id} · Status:{" "}
                  {selectedUpload.status}
                </p>
              )}
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void generateExperiments()}
                disabled={!selectedId || analyzing || loadingUploads}
                className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {analyzing ? "Analyzing..." : "Generate experiments"}
              </button>
            </div>
          </div>

          {!loadingUploads && uploads.length === 0 && !error && (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-800">
                Belum ada dataset untuk dianalisis.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Unggah CSV kampanye terlebih dahulu untuk memulai.
              </p>
              <Link
                href="/uploads/new"
                className="mt-3 inline-flex text-sm font-semibold text-slate-800 underline underline-offset-4"
              >
                Upload campaign data
              </Link>
            </div>
          )}

          {analyzing && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-violet-100 bg-violet-50 p-4"
            >
              <p className="text-sm font-medium text-violet-900">
                AI sedang menganalisis dataset...
              </p>
              <p className="mt-1 text-sm text-violet-700">
                Tunggu hingga hipotesis dan rekomendasi eksperimen selesai dibuat.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4"
            >
              <p className="text-sm font-medium text-red-800">
                Tidak dapat memproses permintaan
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void loadUploads()}
                className="mt-3 text-sm font-semibold text-red-800 underline underline-offset-4"
              >
                Muat ulang dataset
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              {notice}
            </div>
          )}
        </section>

        {advisor && (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">Experiments proposed</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {experiments.length}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Rekomendasi yang dikembalikan AI
                </p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">Hypotheses</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {advisor.hypotheses?.length ?? 0}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Dugaan yang perlu divalidasi
                </p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">Analysis status</p>
                <p className="mt-3 text-xl font-semibold text-slate-950">
                  {advisor.status || "Completed"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {advisor.model ? `Model: ${advisor.model}` : "AI Advisor"}
                </p>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Executive summary
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Analysis overview
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {advisor.summary}
              </p>

              {advisor.insights?.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="font-semibold text-slate-900">
                    Key insights
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {advisor.insights.map((insight, index) => (
                      <li
                        key={index}
                        className="flex gap-3 text-sm leading-6 text-slate-600"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                          {index + 1}
                        </span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {advisor.hypotheses?.length > 0 && (
              <section>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-slate-950">
                    Hypotheses to investigate
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Dugaan awal yang perlu diuji menggunakan eksperimen.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {advisor.hypotheses.map((hypothesis, index) => (
                    <article
                      key={index}
                      className="rounded-2xl border border-amber-200/80 bg-white p-5"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                        Hypothesis {index + 1}
                      </span>
                      <p className="mt-3 text-sm leading-7 text-slate-700">
                        {hypothesis}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-950">
                  Recommended experiments
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Rekomendasi AI sebagai dasar perancangan pengujian A/B.
                </p>
              </div>

              {experiments.length > 0 ? (
                <div className="grid gap-5 xl:grid-cols-2">
                  {experiments.map((experiment, index) => (
                    <article
                      key={`${experiment.name}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-semibold text-violet-700">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                          AI recommendation
                        </span>
                      </div>

                      <h3 className="mt-4 text-lg font-semibold text-slate-950">
                        {experiment.name}
                      </h3>

                      <div className="mt-5 space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Hypothesis
                          </p>
                          <p className="mt-1.5 text-sm leading-6 text-slate-700">
                            {experiment.hypothesis}
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Variable to test
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-800">
                              {experiment.variable}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Success metric
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-800">
                              {experiment.success_metric}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Recommended action
                          </p>
                          <p className="mt-1.5 text-sm leading-6 text-slate-700">
                            {experiment.recommended_action}
                          </p>
                        </div>

                        {experiment.limitations?.length > 0 && (
                          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                              Limitations
                            </p>
                            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-6 text-amber-900/80">
                              {experiment.limitations.map((limitation, i) => (
                                <li key={i}>{limitation}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="font-medium text-slate-900">
                    Belum ada rekomendasi eksperimen.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Coba dataset lain atau periksa respons AI Advisor di backend.
                  </p>
                </div>
              )}
            </section>

            {advisor.disclaimer && (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">
                {advisor.disclaimer}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/analysis/${selectedId}`}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                View full analysis
              </Link>
              <button
                type="button"
                onClick={() => void generateExperiments()}
                disabled={analyzing}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Regenerate recommendations
              </button>
            </div>
          </>
        )}

        <footer className="border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
          Advisora · Experiment recommendations are hypotheses, not guarantees of campaign performance.
        </footer>
      </div>
    </div>
  );
}
