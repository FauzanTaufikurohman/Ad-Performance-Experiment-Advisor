"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const roleLabels: Record<string, string> = {
  platform_super_admin: "Platform Super Admin",
  organization_owner: "Organization Owner",
  organization_admin: "Organization Admin",
  cmo_executive: "CMO / Executive",
  marketing_manager: "Marketing Manager",
  campaign_specialist: "Campaign Specialist",
  data_analyst: "Data Analyst",
  financial_controller: "Financial Controller",
};

const pageTitles: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Overview",
    description: "Ringkasan data dan langkah kerja kampanye.",
  },
  "/campaigns": {
    title: "Campaign health",
    description: "Tinjau performa kampanye dari dataset yang dipilih.",
  },
  "/scenarios": {
    title: "Scenario lab",
    description: "Telusuri kondisi kampanye yang terdeteksi pada data.",
  },
  "/decisions": {
    title: "Decision inbox",
    description: "Tinjau temuan dan rekomendasi dari analisis tersimpan.",
  },
  "/compare": {
    title: "Compare datasets",
    description: "Bandingkan metrik antara dua dataset yang tersimpan.",
  },
  "/uploads/new": {
    title: "Import data",
    description: "Unggah data kampanye dalam format CSV.",
  },
  "/history": {
    title: "Analysis history",
    description: "Buka kembali analisis yang pernah dijalankan.",
  },
  "/experiments": {
    title: "Experiment lab",
    description: "Rancang eksperimen dan evaluasi varian kampanye.",
  },
  "/organization": {
    title: "Organization",
    description: "Kelola organisasi dan akses anggota.",
  },
};

type AppHeaderProps = {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
};

export default function AppHeader({
  mobileMenuOpen,
  onToggleMobileMenu,
}: AppHeaderProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const page =
    pageTitles[pathname] ??
    (pathname.startsWith("/analysis/")
      ? {
          title: "Analysis detail",
          description: "Tinjau metrik, temuan, dan rekomendasi dataset.",
        }
      : {
          title: "Advisora",
          description: "Ruang kerja performa dan eksperimen iklan.",
        });

  return (
    <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-7">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">
          {page.title}
        </h1>
        <p className="mt-1 hidden text-xs text-slate-600 sm:block">
          {page.description}
        </p>
        <p className="hidden truncate text-xs text-slate-600 lg:block">
          {user?.organization_name} ·{" "}
          {roleLabels[user?.organization_role ?? ""] ?? user?.organization_role}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-controls="primary-navigation"
          aria-expanded={mobileMenuOpen}
          onClick={onToggleMobileMenu}
          className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 md:hidden"
        >
          {mobileMenuOpen ? "Tutup menu" : "Menu"}
        </button>
        <span className="hidden max-w-48 truncate text-xs text-slate-600 sm:inline">
          {user?.email}
        </span>
        <button
          type="button"
          onClick={signOut}
          className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
