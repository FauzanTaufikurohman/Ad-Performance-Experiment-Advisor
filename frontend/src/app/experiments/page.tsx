"use client";

import { useEffect, useMemo, useState } from "react";
import {
  API,
  apiFetch,
  canWriteCampaignData,
  formatNumber,
  type AIAdvisor,
  type BayesianExperimentResult,
  type BayesianExperimentRun,
  type HistoryItem,
} from "@/lib/advisor";
import UploadActionLink from "@/components/permissions/upload-action-link";
import { useAuth } from "@/components/auth/auth-provider";
import {
  aggregateCampaigns,
  fetchUploadAnalysis,
  fetchUploads,
  type UploadAnalysis,
} from "@/lib/workspace";

type BayesianResult = BayesianExperimentResult;

type ExperimentHistoryResponse = {
  success: boolean;
  message?: string;
  data?: BayesianExperimentRun[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

async function requestExperimentHistory(page: number) {
  const response = await apiFetch(
    `${API}/api/v1/experiments/results?page=${page}&limit=10`,
    { cache: "no-store" },
  );
  const payload = (await response.json()) as ExperimentHistoryResponse;
  if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
    throw new Error(payload.message || "Riwayat eksperimen gagal dimuat.");
  }
  return {
    runs: payload.data,
    pagination: payload.pagination ?? {
      page,
      limit: 10,
      total: payload.data.length,
      total_pages: 1,
    },
  };
}

function formatRunDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function percentage(value: number) {
  return `${formatNumber(value * 100)}%`;
}

function ExperimentResultView({ result }: { result: BayesianResult }) {
  const outcome =
    result.status === "insufficient_data"
      ? "Data belum mencapai batas cold-start untuk semua arm."
      : result.tied
        ? "Arm terpilih memiliki expected loss yang berdekatan."
        : result.winner
          ? `Expected loss terendah: ${result.winner}`
          : "Evaluasi selesai tanpa pemenang yang ditetapkan.";

  return (
    <div>
      <p className="text-sm text-slate-700">
        {result.iterations.toLocaleString("id-ID")} iterasi · {result.metric.toUpperCase()}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{outcome}</p>
      <div className="mt-4 overflow-x-auto rounded-md border border-slate-300 bg-white">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">Arm</th>
              <th scope="col" className="px-3 py-3 font-semibold">Prob. terbaik</th>
              <th scope="col" className="px-3 py-3 font-semibold">Expected loss</th>
              <th scope="col" className="px-3 py-3 font-semibold">Status</th>
              <th scope="col" className="px-3 py-3 font-semibold">Alokasi simulasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {result.arms.map((arm) => (
              <tr key={arm.name}>
                <th scope="row" className="max-w-40 break-words px-3 py-3 font-medium text-slate-950">
                  {arm.name}
                </th>
                <td className="px-3 py-3 text-slate-800">
                  {percentage(arm.probability_to_be_best)}
                </td>
                <td className="px-3 py-3 text-slate-800">
                  {percentage(arm.expected_loss)}
                </td>
                <td className="px-3 py-3 text-slate-800">
                  {arm.cold_start
                    ? "Cold-start"
                    : arm.ad_fatigued
                      ? "CTR turun 3 hari"
                      : "Data cukup"}
                </td>
                <td className="px-3 py-3 text-slate-800">
                  {result.budget_allocation_pct[arm.name] == null
                    ? "Tidak dialokasikan"
                    : `${formatNumber(result.budget_allocation_pct[arm.name])}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        Alokasi adalah keluaran evaluasi statistik, bukan perubahan budget yang
        dijalankan. Pastikan rancangan eksperimen dan atribusi sesuai sebelum
        menggunakannya untuk keputusan.
      </p>
    </div>
  );
}

export default function ExperimentsPage() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return (
      <p role="status" className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate-700 sm:px-7">
        Memuat sesi...
      </p>
    );
  }
  return <ExperimentsWorkspace key={user?.organization_id ?? "unavailable"} />;
}

function ExperimentsWorkspace() {
  const { user } = useAuth();
  const canEvaluate = canWriteCampaignData(user?.organization_role);
  const [uploads, setUploads] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [analysis, setAnalysis] = useState<UploadAnalysis | null>(null);
  const [selectedArms, setSelectedArms] = useState<string[]>([]);
  const [experimentId, setExperimentId] = useState("");
  const [metric, setMetric] = useState<"ctr" | "cvr">("ctr");
  const [bayesianResult, setBayesianResult] = useState<BayesianResult | null>(null);
  const [advisor, setAdvisor] = useState<AIAdvisor | null>(null);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [askingAdvisor, setAskingAdvisor] = useState(false);
  const [error, setError] = useState("");
  const [advisorError, setAdvisorError] = useState("");
  const [history, setHistory] = useState<BayesianExperimentRun[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const loadingAnalysis = Boolean(
    canEvaluate && selectedId && !analysis && !error,
  );

  useEffect(() => {
    if (!canEvaluate) return;

    let active = true;
    fetchUploads()
      .then(({ items }) => {
        if (!active) return;
        setUploads(items);
        const latest = items[0] ? String(items[0].id) : "";
        setAnalysis(null);
        setBayesianResult(null);
        setAdvisor(null);
        setSelectedArms([]);
        setSelectedId(latest);
        if (latest) setExperimentId(`upload-${latest}`);
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
  }, [canEvaluate, user?.organization_id]);

  useEffect(() => {
    let active = true;
    requestExperimentHistory(historyPage)
      .then(({ runs, pagination }) => {
        if (!active) return;
        setHistory((current) =>
          historyPage === 1 ? runs : [...current, ...runs],
        );
        setHistoryPages(pagination.total_pages);
        setHistoryTotal(pagination.total);
        setHistoryError("");
      })
      .catch((cause: unknown) => {
        if (active) {
          setHistoryError(
            cause instanceof Error
              ? cause.message
              : "Riwayat eksperimen gagal dimuat.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });

    return () => {
      active = false;
    };
  }, [historyPage, historyRevision, user?.organization_id]);

  useEffect(() => {
    if (!selectedId || !canEvaluate) return;

    let active = true;
    fetchUploadAnalysis(selectedId)
      .then((result) => {
        if (active) {
          setAnalysis(result);
          setSelectedArms(
            aggregateCampaigns(result.records)
              .filter((campaign) => campaign.name.trim() !== "")
              .slice(0, 20)
              .map((campaign) => campaign.name),
          );
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setAnalysis(null);
          setError(cause instanceof Error ? cause.message : "Detail dataset gagal dimuat.");
        }
      });

    return () => {
      active = false;
    };
  }, [canEvaluate, selectedId]);

  const campaigns = useMemo(
    () => (analysis ? aggregateCampaigns(analysis.records) : []),
    [analysis],
  );
  const evaluableCampaigns = campaigns.filter((campaign) => campaign.name.trim() !== "");

  const selectedUpload = uploads.find((upload) => String(upload.id) === selectedId);

  async function runBayesianEvaluation() {
    if (!analysis || selectedArms.length < 2) {
      setError("Pilih setidaknya dua kampanye sebagai arm.");
      return;
    }
    if (selectedArms.length > 20) {
      setError("Pilih maksimal 20 kampanye.");
      return;
    }
    if (!experimentId.trim()) {
      setError("ID eksperimen wajib diisi.");
      return;
    }

    setEvaluating(true);
    setError("");
    setBayesianResult(null);

    try {
      const arms = evaluableCampaigns
        .filter((campaign) => selectedArms.includes(campaign.name))
        .map((campaign) => ({
          name: campaign.name,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          conversions: campaign.conversions,
          daily_metrics: campaign.dailyMetrics.slice(-90),
        }));

      const response = await apiFetch(`${API}/api/v1/experiments/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experiment_id: experimentId.trim(),
          metric,
          arms,
        }),
      });
      const json = await response.json();

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.message || "Evaluasi Bayesian gagal dijalankan.");
      }

      setBayesianResult(json.data as BayesianResult);
      setLoadingHistory(true);
      setHistoryError("");
      setHistoryPage(1);
      setHistoryRevision((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evaluasi Bayesian gagal dijalankan.");
    } finally {
      setEvaluating(false);
    }
  }

  async function generateHypotheses() {
    if (!selectedId) {
      setAdvisorError("Pilih dataset sebelum meminta hipotesis.");
      return;
    }

    setAskingAdvisor(true);
    setAdvisorError("");
    setAdvisor(null);

    try {
      const response = await apiFetch(`${API}/api/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: Number(selectedId) }),
      });
      const json = await response.json();

      if (!response.ok || !json.success || !json.ai_advisor) {
        throw new Error(json.message || "AI Advisor belum mengembalikan hipotesis.");
      }
      setAdvisor(json.ai_advisor as AIAdvisor);
    } catch (cause) {
      setAdvisorError(cause instanceof Error ? cause.message : "AI Advisor gagal dijalankan.");
    } finally {
      setAskingAdvisor(false);
    }
  }

  function toggleArm(name: string) {
    setSelectedArms((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : current.length < 20
          ? [...current, name]
          : current,
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-7 sm:py-8">
      <header>
        <p className="text-sm font-medium text-slate-600">Evaluate / Experiments</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Experiment lab
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
          Evaluasi varian kampanye dengan posterior Bayesian atau minta hipotesis untuk ditinjau. Data historis saja tidak membuktikan bahwa kampanye dijalankan secara acak.
        </p>
      </header>

      <section aria-labelledby="experiment-history-title" className="border-y border-slate-300 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="experiment-history-title" className="text-xl font-semibold text-slate-950">
              Riwayat eksperimen organisasi
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              Hasil evaluasi tersedia untuk anggota organisasi dengan akses baca.
            </p>
            {historyTotal > 0 && (
              <p className="mt-1 text-sm text-slate-700">
                {historyTotal.toLocaleString("id-ID")} hasil tersimpan
              </p>
            )}
          </div>
          {canEvaluate && (
            <button
              type="button"
              onClick={() => {
                setHistoryError("");
                setHistoryPage(1);
                setLoadingHistory(true);
                setHistoryRevision((current) => current + 1);
              }}
              disabled={loadingHistory}
              className="min-h-11 self-start rounded-md border border-slate-400 px-4 text-sm font-semibold text-slate-800 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
            >
              Muat ulang
            </button>
          )}
        </div>

        {historyError && (
          <div role="alert" className="mt-4 border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-950">
            <p>{historyError}</p>
            <button
              type="button"
              onClick={() => {
                setHistoryError("");
                setLoadingHistory(true);
                setHistoryRevision((current) => current + 1);
              }}
              className="mt-2 min-h-11 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Coba lagi
            </button>
          </div>
        )}

        {loadingHistory && (
          <p role="status" className="mt-4 text-sm text-slate-700">
            Memuat riwayat eksperimen...
          </p>
        )}

        {!loadingHistory && !historyError && history.length === 0 && (
          <p className="mt-4 text-sm leading-6 text-slate-700">
            Belum ada hasil evaluasi tersimpan di organisasi ini.
            {canEvaluate
              ? " Jalankan evaluasi Bayesian untuk menambahkan hasil."
              : " Minta anggota dengan izin evaluasi untuk menjalankan eksperimen."}
          </p>
        )}

        {history.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-300">
            {history.map((run) => (
              <li key={`${run.result.experiment_id}-${run.result.metric}-${run.evaluated_at}`} className="py-4">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-col justify-center gap-1 rounded-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="break-all font-semibold">{run.result.experiment_id}</span>
                    <span className="text-sm text-slate-700">
                      {run.result.metric.toUpperCase()} · {formatRunDate(run.evaluated_at)}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-slate-700">
                      Dievaluasi oleh {run.evaluated_by || "Akun tidak tersedia"}
                    </p>
                    <ExperimentResultView result={run.result} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        {historyPage < historyPages && !loadingHistory && (
          <button
            type="button"
            onClick={() => {
              setLoadingHistory(true);
              setHistoryPage((current) => current + 1);
            }}
            className="mt-4 min-h-11 rounded-md border border-slate-400 px-4 text-sm font-semibold text-slate-800 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Muat riwayat berikutnya
          </button>
        )}
      </section>

      {canEvaluate && (
        <section className="grid gap-4 border-y border-slate-300 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">Dataset kampanye</span>
            <select
              value={selectedId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedId(nextId);
                setExperimentId(nextId ? `upload-${nextId}` : "");
                setAnalysis(null);
                setSelectedArms([]);
                setBayesianResult(null);
                setAdvisor(null);
                setError("");
                setAdvisorError("");
              }}
              disabled={loadingUploads || uploads.length === 0 || evaluating || askingAdvisor}
              className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-slate-100"
            >
              <option value="">
                {loadingUploads ? "Memuat dataset..." : "Pilih dataset"}
              </option>
              {uploads.map((upload) => (
                <option key={upload.id} value={String(upload.id)}>{upload.filename}</option>
              ))}
            </select>
            {selectedUpload && (
              <span className="mt-2 block text-sm text-slate-700">
                {selectedUpload.row_count} baris · {selectedUpload.status}
              </span>
            )}
          </label>
          <div className="self-end">
            <UploadActionLink
              href="/uploads/new"
              className="inline-flex min-h-11 items-center rounded-md border border-slate-400 px-4 text-sm font-semibold text-slate-800 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Unggah dataset lain
            </UploadActionLink>
          </div>
        </section>
      )}

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Eksperimen tidak dapat diproses</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {canEvaluate && !loadingUploads && uploads.length === 0 && !error && (
        <section className="rounded-md border border-slate-300 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-950">Mulai dari data kampanye</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Unggah CSV untuk melihat kampanye yang tersedia sebagai arm evaluasi.
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
          Memuat baris kampanye...
        </p>
      )}

      {canEvaluate && !loadingAnalysis && analysis && (
        <>
          <section aria-labelledby="bayesian-title" className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <h3 id="bayesian-title" className="text-xl font-semibold text-slate-950">
                Evaluasi Bayesian
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Kampanye yang dipilih menjadi arm. Evaluasi memakai impresi dan klik untuk CTR, atau klik dan konversi untuk CVR.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Jika arm bukan variasi yang menerima traffic secara sebanding dan acak, hasil ini hanya membandingkan posterior dari data masukan.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">ID eksperimen</span>
                  <input
                    value={experimentId}
                    maxLength={100}
                    onChange={(event) => setExperimentId(event.target.value)}
                    className="min-h-11 w-full rounded-md border border-slate-400 px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">Metrik utama</span>
                  <select
                    value={metric}
                    onChange={(event) => setMetric(event.target.value as "ctr" | "cvr")}
                    className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    <option value="ctr">CTR</option>
                    <option value="cvr">CVR</option>
                  </select>
                </label>
              </div>

              <p className="mt-4 text-sm font-medium text-slate-800">
                Pilih 2 sampai 20 kampanye ({selectedArms.length} dipilih)
              </p>
              {evaluableCampaigns.length ? (
                <fieldset className="mt-2 max-h-72 overflow-y-auto border-y border-slate-300">
                  <legend className="sr-only">Kampanye yang digunakan sebagai arm</legend>
                  {evaluableCampaigns.map((campaign) => {
                    const checked = selectedArms.includes(campaign.name);
                    return (
                      <label
                        key={campaign.name}
                        className="flex min-h-12 cursor-pointer items-start gap-3 border-b border-slate-200 px-2 py-3 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleArm(campaign.name)}
                          className="mt-1 h-4 w-4 accent-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                        />
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-medium text-slate-900">
                            {campaign.name || "(Nama kampanye kosong)"}
                          </span>
                          <span className="mt-1 block text-xs text-slate-700">
                            {formatNumber(campaign.impressions, 0)} impresi · {formatNumber(campaign.clicks, 0)} klik · {formatNumber(campaign.conversions, 0)} konversi
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : (
                <p className="mt-3 rounded-md border border-slate-300 bg-white p-4 text-sm text-slate-700">
                  Dataset tidak memiliki nama kampanye yang dapat digunakan sebagai arm.
                </p>
              )}

              <button
                type="button"
                onClick={() => void runBayesianEvaluation()}
                disabled={evaluating || selectedArms.length < 2 || selectedArms.length > 20}
                className="mt-5 inline-flex min-h-11 items-center rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
              >
                {evaluating ? "Menghitung posterior..." : "Jalankan evaluasi Bayesian"}
              </button>
            </div>

            <div className="min-w-0 border-t border-slate-300 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h3 className="text-base font-semibold text-slate-950">Hasil evaluasi</h3>
              {!bayesianResult && !evaluating && (
                <p className="mt-3 rounded-md border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-700">
                  Pilih arm dan metrik, lalu jalankan evaluasi untuk melihat posterior, probabilitas terbaik, serta expected loss.
                </p>
              )}
              {evaluating && (
                <p role="status" className="mt-3 rounded-md border border-slate-300 bg-white p-4 text-sm text-slate-800">
                  Menghitung evaluasi 10.000 iterasi...
                </p>
              )}
              {bayesianResult && (
                <div className="mt-3">
                  <p className="text-sm text-slate-700">
                    ID {bayesianResult.experiment_id}
                  </p>
                  <ExperimentResultView result={bayesianResult} />
                </div>
              )}
            </div>
          </section>

          <section className="border-t border-slate-300 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Hipotesis dari AI Advisor</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">
                  Gunakan hasil ini sebagai usulan untuk ditinjau, bukan sebagai bukti eksperimen atau tindakan otomatis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void generateHypotheses()}
                disabled={askingAdvisor || !selectedId}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                {askingAdvisor ? "Menyusun hipotesis..." : "Buat hipotesis"}
              </button>
            </div>

            {advisorError && (
              <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                {advisorError}
              </p>
            )}
            {askingAdvisor && (
              <p role="status" className="mt-4 text-sm text-slate-800">
                Mengirim dataset ke layanan AI...
              </p>
            )}
            {!advisor && !advisorError && !askingAdvisor && (
              <p className="mt-4 text-sm text-slate-700">
                Hipotesis belum dibuat untuk dataset ini.
              </p>
            )}
            {advisor && (
              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div>
                  <h4 className="font-semibold text-slate-950">Ringkasan</h4>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">
                    {advisor.summary || "AI Advisor tidak mengembalikan ringkasan."}
                  </p>
                  {advisor.disclaimer && (
                    <p className="mt-3 text-xs leading-5 text-slate-700">{advisor.disclaimer}</p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-950">Eksperimen yang diusulkan</h4>
                  {advisor.recommended_experiments?.length ? (
                    <ul className="mt-3 divide-y divide-slate-300 border-y border-slate-300">
                      {advisor.recommended_experiments.map((experiment, index) => (
                        <li key={`${experiment.name}-${index}`} className="py-4">
                          <h5 className="font-medium text-slate-950">{experiment.name}</h5>
                          <p className="mt-2 text-sm leading-6 text-slate-800">{experiment.hypothesis}</p>
                          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <dt className="font-semibold text-slate-700">Variabel</dt>
                              <dd className="mt-1 text-slate-800">{experiment.variable || "Tidak ditentukan"}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-700">Metrik sukses</dt>
                              <dd className="mt-1 text-slate-800">{experiment.success_metric || "Tidak ditentukan"}</dd>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-700">AI Advisor tidak mengembalikan eksperimen yang diusulkan.</p>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
