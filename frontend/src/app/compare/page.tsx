"use client";

import UploadActionLink from "@/components/permissions/upload-action-link";
import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  formatNumber,
  type HistoryItem,
  type Metrics,
} from "@/lib/advisor";
import { fetchUploadAnalysis, fetchUploads, type UploadAnalysis } from "@/lib/workspace";

type MetricRow = {
  label: string;
  key: keyof Metrics;
  format: (value: number | null) => string;
};

const metricRows: MetricRow[] = [
  { label: "Impresi", key: "total_impressions", format: (value) => formatNumber(value, 0) },
  { label: "Klik", key: "total_clicks", format: (value) => formatNumber(value, 0) },
  { label: "Spend", key: "total_spend", format: (value) => formatMoney(value) },
  { label: "Konversi", key: "total_conversions", format: (value) => formatNumber(value, 0) },
  { label: "Nilai konversi", key: "total_conversion_value", format: (value) => formatMoney(value) },
  { label: "CTR", key: "ctr", format: (value) => value == null ? "Tidak tersedia" : `${formatNumber(value)}%` },
  { label: "CPA", key: "cpa", format: (value) => formatMoney(value) },
  { label: "ROAS", key: "roas", format: (value) => value == null ? "Tidak tersedia" : `${formatNumber(value)}x` },
];

function deltaText(before: number | null, after: number | null, format: (value: number | null) => string) {
  if (before == null || after == null) return "Tidak dapat dihitung";
  const delta = after - before;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${format(delta)}`;
}

export default function ComparePage() {
  const [uploads, setUploads] = useState<HistoryItem[]>([]);
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [analyses, setAnalyses] = useState<[UploadAnalysis, UploadAnalysis] | null>(null);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const loadingComparison = Boolean(firstId && secondId && firstId !== secondId && !analyses && !error);

  useEffect(() => {
    let active = true;
    fetchUploads()
      .then(({ items }) => {
        if (!active) return;
        setUploads(items);
        setAnalyses(null);
        setFirstId(items[0] ? String(items[0].id) : "");
        setSecondId(items[1] ? String(items[1].id) : "");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Riwayat gagal dimuat.");
      })
      .finally(() => {
        if (active) setLoadingUploads(false);
      });

    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!firstId || !secondId || firstId === secondId) return;

    let active = true;
    Promise.all([fetchUploadAnalysis(firstId), fetchUploadAnalysis(secondId)])
      .then(([first, second]) => {
        if (active) setAnalyses([first, second]);
      })
      .catch((cause: unknown) => {
        if (active) {
          setAnalyses(null);
          setError(cause instanceof Error ? cause.message : "Dataset gagal dibandingkan.");
        }
      });

    return () => {
      active = false;
    };
  }, [firstId, secondId, retry]);

  function retryLoading() {
    setLoadingUploads(true);
    setAnalyses(null);
    setError("");
    setRetry((current) => current + 1);
  }

  const firstOptions = useMemo(
    () => uploads.filter((upload) => String(upload.id) !== secondId),
    [uploads, secondId],
  );
  const secondOptions = useMemo(
    () => uploads.filter((upload) => String(upload.id) !== firstId),
    [uploads, firstId],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-7 sm:py-8">
      <header>
        <p className="text-sm font-medium text-slate-600">Evaluate / Compare</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Compare datasets
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
          Bandingkan angka yang dihitung backend dari dua upload. Selisih ini bersifat deskriptif dan tidak membuktikan bahwa perubahan dataset menyebabkan perubahan performa.
        </p>
      </header>

      <section className="grid gap-4 border-y border-slate-300 py-5 md:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-2 block text-sm font-medium text-slate-800">Dataset pertama</span>
          <select
            value={firstId}
            onChange={(event) => {
              setFirstId(event.target.value);
              setAnalyses(null);
              setError("");
            }}
            disabled={loadingUploads || uploads.length < 2}
            className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-slate-100"
          >
            <option value="">{loadingUploads ? "Memuat..." : "Pilih dataset"}</option>
            {firstOptions.map((upload) => (
              <option key={upload.id} value={String(upload.id)}>{upload.filename}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-2 block text-sm font-medium text-slate-800">Dataset kedua</span>
          <select
            value={secondId}
            onChange={(event) => {
              setSecondId(event.target.value);
              setAnalyses(null);
              setError("");
            }}
            disabled={loadingUploads || uploads.length < 2}
            className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-slate-100"
          >
            <option value="">{loadingUploads ? "Memuat..." : "Pilih dataset"}</option>
            {secondOptions.map((upload) => (
              <option key={upload.id} value={String(upload.id)}>{upload.filename}</option>
            ))}
          </select>
        </label>
      </section>

      {loadingUploads && (
        <p role="status" className="text-sm text-slate-800">
          Memuat daftar dataset...
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Perbandingan gagal dimuat</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={retryLoading}
            className="mt-3 min-h-11 rounded-md border border-red-400 bg-white px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            Muat ulang data
          </button>
        </div>
      )}

      {!loadingUploads && uploads.length === 0 && !error && (
        <section className="rounded-md border border-slate-300 bg-white p-6">
          <h3 className="font-semibold text-slate-950">Belum ada dataset</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Unggah data kampanye terlebih dahulu. Setelah ada dua upload, Anda dapat membandingkan metriknya.
          </p>
          <UploadActionLink
            href="/uploads/new"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            Unggah data
          </UploadActionLink>
        </section>
      )}

      {!loadingUploads && uploads.length === 1 && !error && (
        <p className="rounded-md border border-slate-300 bg-white p-5 text-sm leading-6 text-slate-800">
          Perbandingan membutuhkan dua dataset berbeda. Unggah periode atau ekspor lain untuk melanjutkan.
        </p>
      )}

      {loadingComparison && (
        <p role="status" className="rounded-md border border-slate-300 bg-white p-4 text-sm text-slate-800">
          Memuat kedua dataset...
        </p>
      )}

      {!loadingComparison && firstId && secondId && firstId === secondId && (
        <p role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
          Pilih dua dataset yang berbeda.
        </p>
      )}

      {!loadingComparison && analyses && (
        <section aria-labelledby="comparison-results">
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {analyses.map((analysis) => (
              <p key={analysis.upload.id} className="break-words text-sm font-medium text-slate-800">
                {analysis.upload.filename}
              </p>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <caption id="comparison-results" className="sr-only">
                Metrik dataset kedua dibandingkan dataset pertama
              </caption>
              <thead className="bg-slate-100 text-slate-800">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Metrik</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Dataset pertama</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Dataset kedua</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Selisih (kedua - pertama)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {metricRows.map((row) => {
                  const before = analyses[0].metrics[row.key];
                  const after = analyses[1].metrics[row.key];
                  return (
                    <tr key={row.key}>
                      <th scope="row" className="px-4 py-3 font-medium text-slate-950">{row.label}</th>
                      <td className="px-4 py-3 text-slate-800">{row.format(before)}</td>
                      <td className="px-4 py-3 text-slate-800">{row.format(after)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {deltaText(before, after, row.format)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
