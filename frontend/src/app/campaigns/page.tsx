"use client";

import Link from "next/link";
import UploadActionLink from "@/components/permissions/upload-action-link";
import { useEffect, useState } from "react";
import { formatMoney, formatNumber, type HistoryItem } from "@/lib/advisor";
import {
  aggregateCampaigns,
  fetchUploadAnalysis,
  fetchUploads,
  type UploadAnalysis,
} from "@/lib/workspace";

function formatRate(value: number | null) {
  return value == null ? "Tidak tersedia" : `${formatNumber(value)}%`;
}

export default function CampaignsPage() {
  const [uploads, setUploads] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [analysis, setAnalysis] = useState<UploadAnalysis | null>(null);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const loadingAnalysis = Boolean(selectedId && !analysis && !error);

  useEffect(() => {
    let active = true;
    fetchUploads()
      .then(({ items }) => {
        if (!active) return;
        setUploads(items);
        setAnalysis(null);
        setSelectedId(items[0] ? String(items[0].id) : "");
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Riwayat gagal dimuat.");
        }
      })
      .finally(() => {
        if (active) setLoadingUploads(false);
      });

    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!selectedId) return;

    let active = true;
    fetchUploadAnalysis(selectedId)
      .then((result) => {
        if (active) setAnalysis(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setAnalysis(null);
          setError(cause instanceof Error ? cause.message : "Analisis gagal dimuat.");
        }
      });

    return () => {
      active = false;
    };
  }, [selectedId, retry]);

  function retryLoading() {
    setLoadingUploads(true);
    setAnalysis(null);
    setError("");
    setRetry((current) => current + 1);
  }

  const campaigns = analysis ? aggregateCampaigns(analysis.records) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-7 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">Diagnose / Campaigns</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Campaign health
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Bandingkan metrik kampanye dalam satu dataset dan buka analisis yang menjelaskan kondisi datanya.
          </p>
        </div>
        <label className="block w-full sm:max-w-sm">
          <span className="mb-2 block text-sm font-medium text-slate-800">
            Dataset
          </span>
          <select
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setAnalysis(null);
              setError("");
            }}
            disabled={loadingUploads || uploads.length === 0}
            className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-slate-100"
          >
            <option value="">
              {loadingUploads ? "Memuat dataset..." : "Pilih dataset"}
            </option>
            {uploads.map((upload) => (
              <option key={upload.id} value={String(upload.id)}>
                {upload.filename}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Data kampanye gagal dimuat</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={retryLoading}
            className="mt-3 min-h-11 rounded-md border border-red-400 bg-white px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            Muat ulang halaman
          </button>
        </div>
      )}

      {!loadingUploads && uploads.length === 0 && !error && (
        <section className="rounded-md border border-slate-300 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-950">Belum ada data kampanye</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Unggah CSV terlebih dahulu. Halaman ini merangkum kampanye dari baris data yang Anda kirim.
          </p>
          <UploadActionLink
            href="/uploads/new"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            Unggah data kampanye
          </UploadActionLink>
        </section>
      )}

      {loadingAnalysis && (
        <p role="status" className="rounded-md border border-slate-300 bg-white p-4 text-sm text-slate-800">
          Memuat metrik dan temuan kampanye...
        </p>
      )}

      {!loadingUploads && uploads.length > 0 && !loadingAnalysis && analysis && (
        <>
          <section className="flex flex-col gap-4 border-b border-slate-300 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-700">
                {analysis.upload.filename} · {formatNumber(analysis.upload.row_count, 0)} baris
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {campaigns.length} kampanye ditemukan pada dataset ini.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/analysis/${analysis.upload.id}`}
                className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Buka analisis lengkap
              </Link>
              <Link
                href="/experiments"
                className="inline-flex min-h-11 items-center rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
              >
                Evaluasi varian
              </Link>
            </div>
          </section>

          {campaigns.length === 0 ? (
            <div className="rounded-md border border-slate-300 bg-white p-6">
              <h3 className="font-semibold text-slate-950">Tidak ada baris kampanye</h3>
              <p className="mt-2 text-sm text-slate-700">
                Periksa format CSV dan kolom campaign pada file sumber.
              </p>
            </div>
          ) : (
            <section aria-labelledby="campaign-list-title">
              <h3 id="campaign-list-title" className="mb-3 text-base font-semibold text-slate-950">
                Kampanye, diurutkan menurut pengeluaran
              </h3>
              <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-slate-100 text-slate-800">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Kampanye</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Spend</th>
                      <th scope="col" className="px-4 py-3 font-semibold">CTR</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Konversi</th>
                      <th scope="col" className="px-4 py-3 font-semibold">CPA</th>
                      <th scope="col" className="px-4 py-3 font-semibold">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {campaigns.map((campaign) => (
                      <tr key={campaign.name} className="align-top">
                        <th scope="row" className="max-w-64 break-words px-4 py-4 font-medium text-slate-950">
                          {campaign.name || "(Nama kampanye kosong)"}
                        </th>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-800">
                          {formatMoney(campaign.spend)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-800">
                          {formatRate(campaign.ctr)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-800">
                          {formatNumber(campaign.conversions, 0)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-800">
                          {formatMoney(campaign.cpa)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-800">
                          {campaign.roas == null ? "Tidak tersedia" : `${formatNumber(campaign.roas)}x`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Metrik ini merangkum data CSV. Perbandingan kampanye tidak membuktikan hubungan sebab-akibat atau bahwa kampanye dijalankan sebagai eksperimen acak.
              </p>
            </section>
          )}

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
            <div className="border-t border-slate-300 pt-5">
              <h3 className="text-base font-semibold text-slate-950">Temuan pada dataset</h3>
              {analysis.findings.length ? (
                <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
                  {analysis.findings.map((finding, index) => (
                    <li key={`${finding.code}-${index}`} className="py-3">
                      <p className="font-medium text-slate-900">{finding.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{finding.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-700">
                  Backend tidak mengembalikan temuan untuk dataset ini.
                </p>
              )}
            </div>
            <div className="border-t border-slate-300 pt-5">
              <h3 className="text-base font-semibold text-slate-950">Kesiapan eksperimen</h3>
              <p className="mt-2 font-medium text-slate-900">{analysis.readiness.summary}</p>
              <p className="mt-2 text-sm text-slate-700">
                Status: {analysis.readiness.status.replaceAll("_", " ")}
              </p>
              <Link
                href="/experiments"
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                Buka Experiment Lab
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
