
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  API,
  apiFetch,
  canWriteCampaignData,
  formatNumber,
  type HistoryItem,
} from "@/lib/advisor";
import UploadActionLink from "@/components/permissions/upload-action-link";
import { useAuth } from "@/components/auth/auth-provider";
import { getRoleExperience } from "@/lib/role-experience";

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
  if (!value) return "Tanggal tidak tersedia";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OverviewPage() {
  const { user } = useAuth();
  const experience = getRoleExperience(user);
  const canWrite = canWriteCampaignData(user?.organization_role);
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
      label: "Total dataset",
      value: formatNumber(totalUploads, 0),
      detail: "Dataset yang tercatat di backend",
      icon: "database",
    },
    {
      label: "Dataset terbaru",
      value: formatNumber(uploads.length, 0),
      detail: "Dataset pada halaman pertama",
      icon: "files",
    },
    {
      label: "Baris pada dataset terbaru",
      value: formatNumber(totalRows, 0),
      detail: "Jumlah baris pada dataset di halaman pertama",
      icon: "chart",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-slate-600">
              {experience.label} · {user?.organization_name}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {experience.focusHeading}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              {experience.focusDescription}
            </p>
          </div>

          <UploadActionLink
            href="/uploads/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            Unggah data kampanye
          </UploadActionLink>
        </section>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-red-800">
                Ringkasan gagal dimuat
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="min-h-11 rounded-md border border-red-400 bg-white px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
            >
              Muat ulang data
            </button>
          </div>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">
              Ringkasan workspace
            </h2>
            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              className="min-h-11 rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
            >
              {loading ? "Memuat..." : "Muat ulang"}
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
                  {loading ? "Memuat..." : stat.value}
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
                  Dataset terbaru
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dataset terbaru yang masuk ke workspace.
                </p>
              </div>
              <Link
                href="/history"
                className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-slate-800 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Lihat semua
              </Link>
            </div>

            {loading ? (
              <div role="status" className="p-6 text-sm text-slate-800">
                Memuat dataset terbaru...
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
                          {formatNumber(upload.row_count, 0)} baris ·{" "}
                          {formatDate(upload.created_at)}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/analysis/${upload.id}`}
                      className="inline-flex min-h-11 shrink-0 items-center self-start rounded-md border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:self-auto"
                    >
                      Buka analisis
                    </Link>
                  </div>
                ))}
              </div>
            ) : !error ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500">
                  +
                </div>
                <h3 className="mt-4 font-medium text-slate-900">
                  Belum ada dataset
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {canWrite
                    ? "Unggah file CSV untuk mulai menganalisis performa iklan."
                    : "Belum ada dataset pada organisasi ini."}
                </p>
                <UploadActionLink
                  href="/uploads/new"
                  className="mt-4 inline-flex min-h-11 items-center rounded-md bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
                >
                  Unggah CSV
                </UploadActionLink>
              </div>
            ) : (
              <p className="p-6 text-sm text-slate-700">
                Dataset tidak ditampilkan sampai pemuatan berhasil.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <h2 className="text-base font-semibold text-slate-950">
                Alur yang disarankan
              </h2>
              <ul className="mt-3 divide-y divide-slate-200">
                {experience.focusLinks.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block min-h-11 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <span className="block text-sm font-semibold text-slate-900">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-sm text-slate-700">
                        {item.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>

          </div>
        </section>

        <p className="pb-2 text-center text-xs text-slate-600">
          Advisora · Campaign performance workspace
        </p>
      </div>
    </div>
  );
}
