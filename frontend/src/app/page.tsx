
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  API,
  apiFetch,
  formatNumber,
  type HistoryItem,
} from "@/lib/advisor";

type UploadResponse = {
  success: boolean;
  message?: string;
  data?: HistoryItem[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    total_pages?: number;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    total_pages?: number;
  };
};

function getUploads(json: UploadResponse): HistoryItem[] {
  if (Array.isArray(json.data)) return json.data;
  return [];
}

function getTotal(json: UploadResponse, uploads: HistoryItem[]) {
  return (
    json.pagination?.total ??
    json.meta?.total ??
    uploads.length
  );
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OverviewPage() {
  const [uploads, setUploads] = useState<HistoryItem[]>([]);
  const [totalUploads, setTotalUploads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `${API}/api/uploads?page=1&limit=10`,
        { cache: "no-store" }
      );

      const json: UploadResponse = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message || "Gagal memuat data overview."
        );
      }

      const items = getUploads(json);

      setUploads(items);
      setTotalUploads(getTotal(json, items));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Backend tidak dapat dihubungi."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  const totalRows = uploads.reduce(
    (sum, item) => sum + (Number(item.row_count) || 0),
    0
  );

  const stats = [
    {
      label: "Total datasets",
      value: formatNumber(totalUploads, 0),
      detail: "Dataset yang tercatat di backend",
      icon: "database",
    },
    {
      label: "Recent datasets",
      value: formatNumber(uploads.length, 0),
      detail: "Dataset pada halaman pertama",
      icon: "files",
    },
    {
      label: "Rows processed",
      value: formatNumber(totalRows, 0),
      detail: "Baris dari dataset yang ditampilkan",
      icon: "chart",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Workspace / Overview
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Overview
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Pantau dataset iklan yang diunggah dan lanjutkan
              analisis performa kampanye dari satu tempat.
            </p>
          </div>

          <Link
            href="/uploads/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <span className="text-lg leading-none">+</span>
            Upload campaign data
          </Link>
        </section>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-red-800">
                Data overview gagal dimuat
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Coba lagi
            </button>
          </div>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">
              Workspace summary
            </h2>
            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-600">
                    {stat.label}
                  </p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    {stat.icon === "database" && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <ellipse cx="12" cy="5" rx="8" ry="3" />
                        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
                        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
                      </svg>
                    )}
                    {stat.icon === "files" && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z" />
                        <path d="M13 3v7h7M8 14h8M8 17h8" />
                      </svg>
                    )}
                    {stat.icon === "chart" && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path d="M4 19V5M4 19h16" />
                        <rect x="7" y="12" width="3" height="5" rx="0.5" />
                        <rect x="12" y="8" width="3" height="9" rx="0.5" />
                        <rect x="17" y="4" width="3" height="13" rx="0.5" />
                      </svg>
                    )}
                  </span>
                </div>

                <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                  {loading ? "—" : stat.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {stat.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.02]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Recent uploads
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dataset terbaru yang masuk ke workspace.
                </p>
              </div>
              <Link
                href="/history"
                className="shrink-0 text-sm font-medium text-slate-700 hover:text-slate-950"
              >
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4 p-6">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-12 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            ) : uploads.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {uploads.slice(0, 5).map((upload) => (
                  <div
                    key={upload.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        CSV
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {upload.filename}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatNumber(upload.row_count, 0)} rows ·{" "}
                          {formatDate(upload.created_at)}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/analysis/${upload.id}`}
                      className="shrink-0 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:self-auto"
                    >
                      View analysis
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500">
                  +
                </div>
                <h3 className="mt-4 font-medium text-slate-900">
                  Belum ada dataset
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Upload file CSV untuk mulai menganalisis performa iklan.
                </p>
                <Link
                  href="/uploads/new"
                  className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Upload CSV
                </Link>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Get started
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                Turn campaign data into experiments.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Unggah data, periksa metrik performa, lalu gunakan AI
                Advisor untuk menemukan hipotesis eksperimen yang bisa diuji.
              </p>
              <Link
                href="/uploads/new"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Start new analysis
              </Link>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
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
                    Experiment Advisor
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    AI-assisted recommendations
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Buka rekomendasi eksperimen dari hasil analisis dataset
                yang sudah kamu unggah.
              </p>
              <Link
                href="/experiments"
                className="mt-4 inline-flex items-center text-sm font-semibold text-slate-800 hover:text-violet-700"
              >
                Explore experiments →
              </Link>
            </article>
          </div>
        </section>

        <p className="pb-2 text-center text-xs text-slate-400">
          Advisora · Campaign performance workspace
        </p>
      </div>
    </div>
  );
}
