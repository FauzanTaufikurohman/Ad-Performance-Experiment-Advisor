
"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Metrics = {
  total_impressions: number;
  total_clicks: number;
  total_spend: number;
  total_conversions: number;
  total_conversion_value: number;
  ctr: number | null;
  cpa: number | null;
  roas: number | null;
};

type Finding = {
  code: string;
  severity: string;
  title: string;
  description: string;
};

type UploadResult = {
  success: boolean;
  message: string;
  filename?: string;
  rows?: number;
  upload_id?: number;
  metrics?: Metrics;
  findings?: Finding[];
  readiness?: unknown;
  data?: unknown[];
};

type HistoryItem = {
  id: number;
  filename: string;
  status: string;
  row_count: number;
  created_at: string;
};

const emptyMetrics: Metrics = {
  total_impressions: 0,
  total_clicks: 0,
  total_spend: 0,
  total_conversions: 0,
  total_conversion_value: 0,
  ctr: null,
  cpa: null,
  roas: null,
};

function number(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${API}/api/uploads?page=1&limit=10`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || "Gagal mengambil riwayat.");
      }

      setHistory(json.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Backend tidak dapat dihubungi."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function uploadCSV(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Pilih file CSV terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API}/api/uploads`, {
        method: "POST",
        body: formData,
      });

      const json: UploadResult = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || "Upload gagal.");
      }

      setResult(json);
      setFile(null);

      const input = document.getElementById("csv-file") as HTMLInputElement;
      if (input) input.value = "";

      await loadHistory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengunggah CSV."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openHistory(id: number) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/uploads/${id}`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || "Gagal membuka detail upload.");
      }

      const detail = json.data;

      setResult({
        success: true,
        message: `Detail upload #${detail.upload?.id ?? id}`,
        filename: detail.upload?.filename,
        rows: detail.upload?.row_count,
        upload_id: detail.upload?.id ?? id,
        metrics: detail.metrics,
        findings: detail.findings,
        readiness: detail.readiness,
        data: detail.records,
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengambil detail."
      );
    } finally {
      setLoading(false);
    }
  }

  const metrics = result?.metrics || emptyMetrics;

  const kpis = [
    { label: "Impressions", value: number(metrics.total_impressions, 0) },
    { label: "Clicks", value: number(metrics.total_clicks, 0) },
    { label: "Spend", value: money(metrics.total_spend) },
    { label: "Conversions", value: number(metrics.total_conversions, 0) },
    { label: "CTR", value: metrics.ctr == null ? "—" : `${number(metrics.ctr)}%` },
    { label: "CPA", value: money(metrics.cpa) },
    { label: "ROAS", value: metrics.roas == null ? "—" : `${number(metrics.roas)}x` },
    { label: "Conversion Value", value: money(metrics.total_conversion_value) },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Campaign intelligence
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Ad Performance Advisor
            </h1>
            <p className="mt-2 text-slate-400">
              Analyze campaign performance and identify experiment opportunities.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            CSV analysis workspace
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Upload campaign data</h2>
          <p className="mt-1 text-sm text-slate-400">
            Upload CSV dengan kolom date, campaign, impressions, clicks, spend,
            conversions, dan conversion_value. Maksimal 10 MB.
          </p>

          <form onSubmit={uploadCSV} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-100"
            />
            <button
              type="submit"
              disabled={loading || !file}
              className="shrink-0 rounded-lg bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Processing..." : "Analyze CSV"}
            </button>
          </form>
        </section>

        {result && (
          <>
            <section className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm text-slate-400">Latest analysis</p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {result.filename || "Campaign report"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {result.message} · {result.rows ?? result.data?.length ?? 0} rows
                  {result.upload_id ? ` · Upload #${result.upload_id}` : ""}
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <article key={kpi.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">{kpi.label}</p>
                  <p className="mt-3 break-words text-2xl font-bold">{kpi.value}</p>
                </article>
              ))}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Performance findings</h2>
              <div className="mt-4 space-y-3">
                {result.findings?.length ? result.findings.map((finding, index) => (
                  <article key={`${finding.code}-${index}`} className="rounded-xl border border-slate-700 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-xs uppercase text-cyan-300">
                        {finding.severity}
                      </span>
                      <h3 className="font-semibold">{finding.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{finding.description}</p>
                  </article>
                )) : (
                  <p className="text-sm text-slate-400">Tidak ada findings yang dikembalikan oleh API.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Experiment readiness</h2>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                {JSON.stringify(result.readiness ?? {}, null, 2)}
              </pre>
              <p className="mt-3 text-xs text-slate-500">
                Gunakan hasil readiness sebagai panduan. Kelayakan eksperimen bukan
                jaminan bahwa suatu variasi iklan akan menang.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Campaign records</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-700 text-slate-400">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Campaign</th>
                      <th className="p-3">Impressions</th>
                      <th className="p-3">Clicks</th>
                      <th className="p-3">Spend</th>
                      <th className="p-3">Conversions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.data || []).map((row, index) => {
                      const record = row as Record<string, unknown>;
                      return (
                        <tr key={index} className="border-b border-slate-800 last:border-0">
                          <td className="p-3 whitespace-nowrap">
                            {String(record.date ?? "").slice(0, 10)}
                          </td>
                          <td className="p-3">{String(record.campaign ?? "—")}</td>
                          <td className="p-3">{number(Number(record.impressions), 0)}</td>
                          <td className="p-3">{number(Number(record.clicks), 0)}</td>
                          <td className="p-3">{money(Number(record.spend))}</td>
                          <td className="p-3">{number(Number(record.conversions), 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Upload history</h2>
              <p className="mt-1 text-sm text-slate-400">Buka upload sebelumnya untuk melihat hasil analisis.</p>
            </div>
            <button
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {historyLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="p-3">File</th>
                  <th className="p-3">Rows</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Uploaded</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800 last:border-0">
                    <td className="p-3">{item.filename}</td>
                    <td className="p-3">{number(item.row_count, 0)}</td>
                    <td className="p-3">{item.status}</td>
                    <td className="p-3 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => void openHistory(item.id)}
                        disabled={loading}
                        className="rounded-md border border-slate-700 px-3 py-1.5 text-cyan-300 hover:bg-slate-800 disabled:opacity-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!history.length && (
                  <tr>
                    <td colSpan={5} className="p-5 text-center text-slate-500">
                      Belum ada riwayat upload atau riwayat gagal dimuat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pb-4 text-center text-xs text-slate-500">
          Ad Performance Advisor · Metrics are calculated from uploaded campaign data.
        </footer>
      </div>
    </main>
  );
}
