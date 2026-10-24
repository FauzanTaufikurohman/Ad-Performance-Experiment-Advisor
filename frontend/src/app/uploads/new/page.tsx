"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { API, apiFetch, type UploadResult } from "@/lib/advisor";

export default function NewUploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!file) {
      setError("Pilih file CSV terlebih dahulu.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Format file harus CSV.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10 MB.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch(`${API}/api/uploads`, {
        method: "POST",
        body: formData,
      });

      const json: UploadResult = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || "Upload CSV gagal.");
      }

      if (!json.upload_id) {
        setSuccess("CSV berhasil diproses, tetapi ID analisis tidak dikembalikan oleh API.");
        return;
      }

      router.push(`/analysis/${json.upload_id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Backend tidak dapat dihubungi. Periksa koneksi API.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <p className="text-sm font-medium text-blue-700">DATA WORKSPACE</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Import campaign data
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Unggah data iklan dalam format CSV untuk menghitung metrik performa
          dan menemukan peluang eksperimen.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {success}
          <p className="mt-2">
            Buka <a className="font-semibold underline" href="/history">Analysis History</a> untuk memeriksa hasil yang tersimpan.
          </p>
        </div>
      )}

      <form
        onSubmit={handleUpload}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">
            ↑
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Upload CSV file</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Gunakan file berisi data kampanye iklan. Ukuran maksimal 10 MB.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-6 flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/50"
        >
          <span className="text-sm font-semibold text-slate-800">
            {file ? file.name : "Choose a CSV file"}
          </span>
          <span className="mt-2 text-xs text-slate-500">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB · Click to change file`
              : "Click here to browse your files"}
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError("");
            setSuccess("");
          }}
        />

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Required CSV columns
          </p>
          <p className="mt-2 break-words text-xs leading-6 text-slate-600">
            date, campaign, impressions, clicks, spend, conversions,
            conversion_value
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !file}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing CSV..." : "Upload and analyze"}
          </button>
        </div>
      </form>

      <p className="text-xs leading-5 text-slate-500">
        Hasil analisis bergantung pada kelengkapan dan kualitas data yang
        diunggah. Pastikan data yang digunakan memang boleh diproses.
      </p>
    </div>
  );
}
