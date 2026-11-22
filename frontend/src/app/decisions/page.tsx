"use client";

import Link from "next/link";
import UploadActionLink from "@/components/permissions/upload-action-link";
import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/lib/advisor";
import {
  fetchDecisionInbox,
  type DecisionItem,
  type PageResult,
} from "@/lib/workspace";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function DecisionsPage() {
  const [result, setResult] = useState<PageResult<DecisionItem>>({
    items: [],
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    fetchDecisionInbox(page)
      .then((response) => {
        if (active) setResult(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Temuan gagal dimuat.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, retry]);

  function retryLoading() {
    setLoading(true);
    setError("");
    setRetry((current) => current + 1);
  }

  function loadPage(nextPage: number) {
    setLoading(true);
    setError("");
    setPage(nextPage);
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return result.items.filter((item) => {
      const matchesSeverity = severity === "all" || item.severity === severity;
      const matchesSearch =
        !query ||
        [item.title, item.description, item.filename, item.code]
          .join(" ")
          .toLocaleLowerCase("id-ID")
          .includes(query);
      return matchesSeverity && matchesSearch;
    });
  }, [result.items, search, severity]);

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-7 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">Review / Decisions</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Temuan untuk ditinjau
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Temuan berasal dari analisis dataset Anda, bukan dari feed aktivitas sintetis. Halaman ini tidak mengubah kampanye atau menandai temuan sebagai selesai.
          </p>
        </div>
        <p className="text-sm text-slate-700" aria-live="polite">
          {loading ? "Memuat..." : `${formatNumber(result.total, 0)} temuan`}
        </p>
      </header>

      <section className="flex flex-col gap-3 border-y border-slate-300 py-4 sm:flex-row">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-sm font-medium text-slate-800">Cari temuan pada halaman ini</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nama file atau isi temuan"
            className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
        </label>
        <label className="block sm:w-56">
          <span className="mb-1 block text-sm font-medium text-slate-800">Tingkat</span>
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <option value="all">Semua tingkat</option>
            <option value="critical">Kritis</option>
            <option value="warning">Peringatan</option>
            <option value="info">Informasi</option>
          </select>
        </label>
      </section>

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Inbox gagal dimuat</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={retryLoading}
            className="mt-3 min-h-11 rounded-md border border-red-400 bg-white px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            Coba lagi
          </button>
        </div>
      )}

      {loading && (
        <p role="status" className="rounded-md border border-slate-300 bg-white p-4 text-sm text-slate-800">
          Memuat temuan dari dataset Anda...
        </p>
      )}

      {!loading && !error && result.total === 0 && (
        <section className="rounded-md border border-slate-300 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-950">Belum ada temuan</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Unggah dataset agar aturan diagnostik dapat memeriksa impresi, klik, biaya, dan konversi.
          </p>
          <UploadActionLink
            href="/uploads/new"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            Unggah dataset
          </UploadActionLink>
        </section>
      )}

      {!loading && !error && result.total > 0 && filtered.length === 0 && (
        <p className="rounded-md border border-slate-300 bg-white p-5 text-sm text-slate-800">
          Tidak ada temuan pada halaman ini yang cocok dengan filter. Ubah kata kunci atau tingkat temuan.
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ol className="divide-y divide-slate-300 border-y border-slate-300">
          {filtered.map((item) => (
            <li key={item.id} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <article className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-semibold text-slate-950">{item.title}</h3>
                  <span className="text-xs font-semibold text-slate-700">
                    {item.severity === "critical"
                      ? "Kritis"
                      : item.severity === "warning"
                        ? "Peringatan"
                        : "Informasi"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {item.filename} · {formatDate(item.created_at)}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-800">{item.description}</p>
                {item.recommendation ? (
                  <p className="mt-3 text-sm leading-6 text-slate-800">
                    <span className="font-semibold">Yang perlu diperiksa: </span>
                    {item.recommendation}
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    Rekomendasi tidak tersimpan untuk temuan lama. Buka analisis untuk meninjau konteks dataset.
                  </p>
                )}
              </article>
              <Link
                href={`/analysis/${item.upload_id}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-400 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Buka analisis
              </Link>
            </li>
          ))}
        </ol>
      )}

      {!loading && !error && result.totalPages > 1 && (
        <nav aria-label="Halaman temuan" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            Halaman {page} dari {result.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="min-h-11 rounded-md border border-slate-400 px-4 text-sm font-medium text-slate-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => loadPage(Math.min(result.totalPages, page + 1))}
              disabled={page === result.totalPages}
              className="min-h-11 rounded-md border border-slate-400 px-4 text-sm font-medium text-slate-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Berikutnya
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
