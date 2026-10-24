
"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const pageTitles: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Overview",
    description: "A summary of your advertising performance.",
  },
  "/uploads/new": {
    title: "Import Data",
    description: "Upload a CSV file to analyze your campaigns.",
  },
  "/history": {
    title: "Analysis History",
    description: "Review your previous datasets and analyses.",
  },
  "/experiments": {
    title: "Experiments",
    description: "Review hypotheses and recommended experiments.",
  },
  "/settings": {
    title: "Settings",
    description: "Manage application preferences.",
  },
};

export default function AppHeader() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const page =
    pageTitles[pathname] ??
    (pathname.startsWith("/analysis/")
      ? {
          title: "Analysis Detail",
          description: "Review metrics, findings, and AI recommendations.",
        }
      : {
          title: "Advisora",
          description: "Ad Performance & Experiment Advisor.",
        });

  return (
    <header className="flex min-h-[72px] items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 sm:px-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          {page.title}
        </h1>
        <p className="mt-1 hidden text-xs text-slate-500 sm:block">
          {page.description}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden max-w-48 truncate text-xs text-slate-500 sm:inline">
          {user?.email}
        </span>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
