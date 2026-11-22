"use client";

import Link from "next/link";
import UploadActionLink from "@/components/permissions/upload-action-link";
import { useEffect, useMemo, useState } from "react";
import { formatNumber, type HistoryItem } from "@/lib/advisor";
import {
  fetchUploadAnalysis,
  fetchUploads,
  type UploadAnalysis,
} from "@/lib/workspace";

const scenarios = [
  {
    code: "SPEND_WITHOUT_CONVERSIONS",
    title: "Pengeluaran tanpa konversi",
    explanation: "Biaya tercatat, tetapi dataset tidak menunjukkan konversi.",
    nextStep: "Validasi tracking, jendela atribusi, dan halaman tujuan sebelum menghentikan kampanye.",
  },
  {
    code: "ZERO_CLICKS",
    title: "Impresi tanpa klik",
    explanation: "Ada impresi, tetapi tidak ada klik yang tercatat.",
    nextStep: "Periksa ekspor data, materi iklan, audiens, dan penempatan.",
  },
  {
    code: "ZERO_IMPRESSIONS",
    title: "Impresi tidak tercatat",
    explanation: "CTR tidak dapat dihitung tanpa impresi.",
    nextStep: "Periksa filter tanggal, status kampanye, dan kelengkapan file sumber.",
  },
  {
    code: "ZERO_SPEND",
    title: "Biaya tidak tercatat",
    explanation: "ROAS tidak dapat dihitung ketika spend bernilai nol.",
    nextStep: "Periksa kolom biaya dan konsistensi mata uang pada file sumber.",
  },
  {
    code: "CTR_AVAILABLE",
    title: "CTR tersedia untuk ditinjau",
    explanation: "CTR agregat berhasil dihitung dari impresi dan klik.",
    nextStep: "Bandingkan dengan target atau periode yang sebanding, bukan benchmark yang tidak tersedia di data.",
  },
  {
    code: "NO_RULE_TRIGGERED",
    title: "Tidak ada aturan khusus terpicu",
    explanation: "Aturan diagnostik dasar tidak menemukan kondisi khusus.",
    nextStep: "Tinjau metrik dan konteks bisnis sebelum menyimpulkan performa.",
  },
  {
    code: "NO_DATA",
    title: "Dataset tidak memiliki baris valid",
    explanation: "Tidak ada record yang dapat dianalisis.",
    nextStep: "Periksa header dan isi CSV, lalu unggah file yang sudah diperbaiki.",
  },
];

export default function ScenariosPage() {
  const [uploads, setUploads] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0].code);
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
        setSelectedId((current) =>
          current && items.some((item) => String(item.id) === current)
            ? current
            : items[0]
              ? String(items[0].id)
              : "",
        );
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

  const findings = useMemo(() => analysis?.findings ?? [], [analysis]);
  const selected = scenarios.find((scenario) => scenario.code === selectedScenario) ?? scenarios[0];
  const matches = useMemo(
    () => findings.filter((finding) => finding.code === selectedScenario),
    [findings, selectedScenario],
  );
  const scenarioCounts = useMemo(
    () =>
      new Map(
        scenarios.map((scenario) => [
          scenario.code,
          findings.filter((finding) => finding.code === scenario.code).length,
        ]),
      ),
    [findings],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-7 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">Diagnose / Scenarios</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Scenario lab
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Pilih kondisi yang ingin diperiksa. Temuan hanya berasal dari aturan yang dijalankan backend pada dataset terpilih.
          </p>
        </div>
        <label className="block w-full sm:max-w-sm">
          <span className="mb-2 block text-sm font-medium text-slate-800">Dataset</span>
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
          <p className="font-semibold">Skenario gagal dimuat</p>
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
          <h3 className="text-lg font-semibold text-slate-950">Belum ada skenario untuk ditinjau</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Skenario muncul setelah backend memeriksa dataset kampanye yang valid.
          </p>
          <UploadActionLink
            href="/uploads/new"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            Unggah CSV kampanye
          </UploadActionLink>
        </section>
      )}

      {loadingAnalysis && (
        <p role="status" className="rounded-md border border-slate-300 bg-white p-4 text-sm text-slate-800">
          Memeriksa temuan pada dataset...
        </p>
      )}

      {!loadingAnalysis && analysis && (
        <>
          <section aria-label="Pilih skenario" className="grid gap-x-6 border-y border-slate-300 sm:grid-cols-2 xl:grid-cols-3">
            {scenarios.map((scenario) => {
              const active = selectedScenario === scenario.code;
              const count = scenarioCounts.get(scenario.code) ?? 0;
              return (
                <button
                  type="button"
                  key={scenario.code}
                  aria-pressed={active}
                  onClick={() => setSelectedScenario(scenario.code)}
                  className={`flex min-h-[76px] items-center justify-between gap-4 border-b border-slate-200 px-2 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                    active ? "text-blue-900" : "text-slate-800 hover:text-slate-950"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{scenario.title}</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-700">
                      {scenario.explanation}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatNumber(count, 0)}
                  </span>
                </button>
              );
            })}
          </section>

          <section aria-live="polite" className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">{analysis.upload.filename}</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{selected.title}</h3>
              {matches.length ? (
                <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-300">
                  {matches.map((finding, index) => (
                    <li key={`${finding.code}-${index}`} className="py-4">
                      <p className="font-semibold text-slate-950">{finding.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{finding.description}</p>
                      {finding.recommendation && (
                        <p className="mt-3 text-sm leading-6 text-slate-900">
                          <span className="font-semibold">Yang perlu diperiksa: </span>
                          {finding.recommendation}
                        </p>
                      )}
                      <Link
                        href={`/analysis/${analysis.upload.id}`}
                        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        Buka data dan temuan
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 rounded-md border border-slate-300 bg-white p-5">
                  <p className="font-medium text-slate-950">
                    Skenario ini tidak terdeteksi pada dataset terpilih.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Pemeriksaan mengikuti data yang masuk dan aturan backend. Ini bukan jaminan bahwa kondisi tersebut tidak terjadi di luar dataset.
                  </p>
                </div>
              )}
            </div>

            <aside className="h-fit border-t border-slate-300 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <h3 className="font-semibold text-slate-950">Langkah pemeriksaan</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{selected.nextStep}</p>
              <p className="mt-4 text-xs leading-5 text-slate-700">
                Advisora tidak mengubah kampanye. Verifikasi data dan konteks bisnis sebelum mengambil tindakan.
              </p>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
