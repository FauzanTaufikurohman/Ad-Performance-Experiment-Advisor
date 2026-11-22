"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API, type AuthUser, type OrganizationMembership } from "@/lib/advisor";
import { useAuth } from "@/components/auth/auth-provider";
import ThemeToggle from "@/components/theme/theme-toggle";

type InvitationResponse = {
  success?: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
  organizations?: OrganizationMembership[];
};

export default function AcceptInvitationForm({
  invitationToken,
}: {
  invitationToken: string;
}) {
  const router = useRouter();
  const { acceptSession } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  async function acceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`${API}/api/auth/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: invitationToken,
          name: name.trim(),
          password,
        }),
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      let payload: InvitationResponse;
      try {
        payload = (await response.json()) as InvitationResponse;
      } catch {
        throw new Error(`Respons server tidak valid (HTTP ${response.status}).`);
      }
      if (!response.ok || !payload.success || !payload.token || !payload.user) {
        throw new Error(payload.message || "Undangan tidak dapat diterima.");
      }
      acceptSession(payload.token, payload.user, payload.organizations ?? []);
      router.replace("/");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Undangan tidak dapat diterima. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">
              Advisora
            </p>
            <p className="mt-1 text-xs text-slate-600">Undangan organisasi</p>
          </div>
          <ThemeToggle />
        </div>

        <section className="rounded-md border border-slate-300 bg-white p-5 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Terima undangan
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Gunakan password akun Advisora Anda. Jika belum memiliki akun,
            masukkan nama dan buat password baru. Pastikan link ini berasal
            dari administrator organisasi yang Anda kenal.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
            >
              {error}
            </p>
          )}

          {invitationToken ? (
            <form onSubmit={acceptInvitation} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-900">
                Nama
                <input
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                />
              </label>
              <label className="block text-sm font-medium text-slate-900">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-11 w-full rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
              >
                {submitting ? "Memproses undangan..." : "Terima undangan"}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-3">
              <p role="alert" className="text-sm text-slate-800">
                Token tidak ditemukan pada link ini. Minta administrator
                organisasi mengirimkan undangan baru.
              </p>
              <Link
                href="/auth"
                className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Kembali ke halaman masuk
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
