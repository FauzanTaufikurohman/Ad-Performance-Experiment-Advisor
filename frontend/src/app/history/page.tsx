
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API, apiFetch, formatNumber } from "@/lib/advisor";

type UploadItem = {
  id: number;
  filename: string;
  status: string;
  row_count: number;
  created_at: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

function getObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function getUploadList(json: unknown): UploadItem[] {
  const root = getObject(json);
  const data = root.data;

  if (Array.isArray(data)) {
    return data as UploadItem[];
  }

  const nested = getObject(data);

  if (Array.isArray(nested.uploads)) {
    return nested.uploads as UploadItem[];
  }

  if (Array.isArray(nested.items)) {
    return nested.items as UploadItem[];
  }

  if (Array.isArray(root.uploads)) {
    return root.uploads as UploadItem[];
  }

  if (Array.isArray(root.items)) {
    return root.items as UploadItem[];
  }

  return [];
}

function getPagination(
  json: unknown,
  page: number,
  limit: number,
  count: number,
): Pagination {
  const root = getObject(json);
  const data = getObject(root.data);
  const pagination = getObject(root.pagination);
  const nestedPagination = getObject(data.pagination);
  const meta = getObject(root.meta);

  const source =
    Object.keys(pagination).length > 0
      ? pagination
      : Object.keys(nestedPagination).length > 0
        ? nestedPagination
        : Object.keys(meta).length > 0
          ? meta
          : root;

  const totalValue = Number(source.total ?? source.total_items ?? count);
  const limitValue = Number(source.limit ?? limit);
  const pageValue = Number(source.page ?? page);
  const pagesValue = Number(
    source.total_pages ??
      source.last_page ??
      Math.max(1, Math.ceil(totalValue / Math.max(1, limitValue))),
  );

  return {
    page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : page,
    limit:
      Number.isFinite(limitValue) && limitValue > 0 ? limitValue : limit,
    total: Number.isFinite(totalValue) ? totalValue : count,
    total_pages:
      Number.isFinite(pagesValue) && pagesValue > 0 ? pagesValue : 1,
  };
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusStyle(status: string) {
  const value = status.toLowerCase();

  if (
    value.includes("success") ||
    value.includes("completed") ||
    value.includes("processed")
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (value.includes("fail") || value.includes("error")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (value.includes("pending") || value.includes("process")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

export default function HistoryPage() {
  const router = useRouter();

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `${API}/api/uploads?page=${page}&limit=10`,
        { cache: "no-store" },
      );

      const json: unknown = await response.json();

      if (!response.ok) {
        const message = getObject(json).message;

        throw new Error(
          typeof message === "string"
            ? message
            : `Gagal mengambil riwayat (HTTP ${response.status}).`,
        );
      }

      const items = getUploadList(json);
      setUploads(items);
      setPagination(getPagination(json, page, 10, items.length));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil riwayat.",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  const filteredUploads = uploads.filter((upload) =>
    (upload.filename ?? "")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  const totalPages = Math.max(1, pagination.total_pages);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
      {/* Heading */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Workspace / History
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Analysis History
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Lihat dataset yang pernah diunggah dan buka kembali hasil analisis
            performa kampanye.
          </p>
        </div>

        <Link
          href="/uploads/new"
          className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
        >
          + Upload dataset
        </Link>
      </header>
      {/* Summary */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total dataset
          </p>

          <p className="mt-3 text-3xl font-bold text-slate-950">
            {loading ? "—" : formatNumber(pagination.total, 0)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Total upload yang dilaporkan API
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Dataset pada halaman ini
          </p>

          <p className="mt-3 text-3xl font-bold text-slate-950">
            {loading ? "—" : formatNumber(uploads.length, 0)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Maksimal 10 dataset per halaman
          </p>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">
              Uploaded datasets
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pilih dataset untuk membuka detail analisis.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama file..."
              aria-label="Cari nama file"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-900">
              Gagal memuat riwayat
            </p>
            <p className="mt-1 text-sm text-red-700">{error}</p>

            <button
              onClick={() => void loadHistory()}
              className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Coba lagi
            </button>
          </div>
        )}

        {!error && loading && (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        )}

        {!error && !loading && filteredUploads.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path
                  d="M7 3.75h7l5 5v11.5H7a2 2 0 0 1-2-2v-12a2.5 2.5 0 0 1 2-2.5Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 4v5h5M9 13h6M9 16.5h6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h3 className="mt-4 font-semibold text-slate-900">
              {search
                ? "Dataset tidak ditemukan"
                : "Belum ada dataset"}
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {search
                ? "Coba gunakan kata kunci nama file yang berbeda."
                : "Upload file CSV untuk mulai menganalisis performa kampanye."}
            </p>

            {!search && (
              <Link
                href="/uploads/new"
                className="mt-5 inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Upload CSV pertama
              </Link>
            )}
          </div>
        )}

        {!error && !loading && filteredUploads.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Dataset</th>
                    <th className="px-5 py-4 font-semibold">Rows</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Uploaded</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredUploads.map((upload) => (
                    <tr
                      key={upload.id}
                      className="transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                            CSV
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-xs truncate font-semibold text-slate-900">
                              {upload.filename || `Upload #${upload.id}`}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              ID: {upload.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatNumber(upload.row_count, 0)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle(upload.status || "")}`}
                        >
                          {upload.status || "Unknown"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {formatDate(upload.created_at)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() =>
                            router.push(`/analysis/${upload.id}`)
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          View analysis →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Halaman {pagination.page} dari {totalPages}
                {pagination.total > 0 && (
                  <>
                    {" · "}
                    {formatNumber(pagination.total, 0)} dataset
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <button
                  onClick={() =>
                    setPage((current) =>
                      Math.min(totalPages, current + 1),
                    )
                  }
                  disabled={page >= totalPages || loading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <p className="text-xs leading-5 text-slate-400">
        Riwayat ditampilkan berdasarkan data yang dikembalikan oleh backend.
        Pencarian nama file saat ini berlaku untuk data pada halaman aktif.
      </p>
    </div>
  );
}
