"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { API, type AuthUser } from "@/lib/advisor";
import { useAuth } from "@/components/auth/auth-provider";

type AuthResponse = {
  success?: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
};

async function parseAuthResponse(response: Response): Promise<AuthResponse> {
  const body = await response.text();

  try {
    return JSON.parse(body) as AuthResponse;
  } catch {
    if (response.status === 404) {
      throw new Error(
        "Endpoint autentikasi tidak ditemukan. Restart backend dari folder backend agar menggunakan versi terbaru.",
      );
    }
    throw new Error(
      `Respons backend tidak valid (HTTP ${response.status}). Periksa server API lalu coba lagi.`,
    );
  }
}

export default function AuthPage() {
  const router = useRouter();
  const { status, acceptSession } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const loginHeadingRef = useRef<HTMLHeadingElement>(null);
  const registerHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousMode = useRef(mode);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [router, status]);

  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    (mode === "login" ? loginHeadingRef : registerHeadingRef).current?.focus();
  }, [mode]);

  function switchMode(nextMode: "login" | "register") {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setError("");
    setMode(nextMode);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formMode = event.currentTarget.dataset.mode;
    const registering = formMode === "register";

    try {
      const response = await fetch(
        `${API}/api/auth/${registering ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            registering
              ? {
                  name,
                  email: registerEmail,
                  password: registerPassword,
                }
              : { email: loginEmail, password: loginPassword },
          ),
        },
      );
      const json = await parseAuthResponse(response);

      if (!response.ok || !json.success || !json.token || !json.user) {
        throw new Error(json.message || "Autentikasi gagal.");
      }

      acceptSession(json.token, json.user);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Backend tidak dapat dihubungi. Silakan coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6">
      <div className="w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-center gap-3 sm:justify-start">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-base font-bold text-white shadow-sm shadow-blue-900/15">
            A
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">
              Advisora
            </p>
            <p className="text-[11px] text-slate-500">
              Ad performance workspace
            </p>
          </div>
        </div>

        <section
          className={`container ${mode === "register" ? "active" : ""}`}
          aria-label="Autentikasi Advisora"
        >
          <div className="formContainer signUp">
            <form
              data-mode="register"
              onSubmit={handleSubmit}
              inert={mode !== "register"}
              className="form"
            >
              <span className="eyebrow">BUAT WORKSPACE ANDA</span>
              <h1
                ref={registerHeadingRef}
                className="heading"
                tabIndex={-1}
              >
                Buat akun
              </h1>
              <p className="description">
                Mulai simpan data dan insight kampanye Anda di satu tempat.
              </p>

              {error && mode === "register" && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}

              <label className="field">
                <span>Nama</span>
                <input
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nama Anda"
                  tabIndex={mode === "register" ? 0 : -1}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  placeholder="nama@email.com"
                  tabIndex={mode === "register" ? 0 : -1}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  placeholder="Minimal 8 karakter"
                  tabIndex={mode === "register" ? 0 : -1}
                />
              </label>
              <button
                type="submit"
                disabled={loading || status === "loading"}
                tabIndex={mode === "register" ? 0 : -1}
                className="submit"
              >
                {loading ? "Memproses..." : "Buat akun"}
              </button>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="mobileSwitch"
              >
                Sudah punya akun? <strong>Masuk</strong>
              </button>
            </form>
          </div>

          <div className="formContainer signIn">
            <form
              data-mode="login"
              onSubmit={handleSubmit}
              inert={mode !== "login"}
              className="form"
            >
              <span className="eyebrow">SELAMAT DATANG KEMBALI</span>
              <h1 ref={loginHeadingRef} className="heading" tabIndex={-1}>
                Masuk ke akun
              </h1>
              <p className="description">
                Lanjutkan analisis kampanye dan temukan peluang eksperimen.
              </p>

              {error && mode === "login" && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}

              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="nama@email.com"
                  tabIndex={mode === "login" ? 0 : -1}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Masukkan password"
                  tabIndex={mode === "login" ? 0 : -1}
                />
              </label>
              <button
                type="submit"
                disabled={loading || status === "loading"}
                tabIndex={mode === "login" ? 0 : -1}
                className="submit"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="mobileSwitch"
              >
                Belum punya akun? <strong>Daftar</strong>
              </button>
            </form>
          </div>

          <div className="toggleContainer" aria-live="polite">
            <div className="toggle">
              <div className="togglePanel toggleLeft">
                <span className="panelMark" aria-hidden="true">
                  A
                </span>
                <p className="panelEyebrow">WORKSPACE ANDA MENUNGGU</p>
                <h2>Selamat datang kembali!</h2>
                <p>
                  Masuk untuk melihat kembali performa kampanye dan insight
                  yang sudah Anda simpan.
                </p>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="panelButton"
                  tabIndex={mode === "register" ? 0 : -1}
                >
                  Masuk
                </button>
              </div>
              <div className="togglePanel toggleRight">
                <span className="panelMark" aria-hidden="true">
                  A
                </span>
                <p className="panelEyebrow">MULAI DENGAN DATA ANDA</p>
                <h2>Halo, teman baru!</h2>
                <p>
                  Buat akun untuk mengelola dataset, riwayat analisis, dan
                  rekomendasi eksperimen Anda.
                </p>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="panelButton"
                  tabIndex={mode === "login" ? 0 : -1}
                >
                  Daftar
                </button>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          Tanpa role — setiap akun memiliki fitur yang sama dan data yang
          terpisah.
        </p>
      </div>
    </main>
  );
}
