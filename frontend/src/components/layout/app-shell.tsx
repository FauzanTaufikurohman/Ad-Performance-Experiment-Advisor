
"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import AppSidebar from "./app-sidebar";
import AppHeader from "./app-header";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50/60">
          {children}
        </div>
      }
    >
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = openMenuPath === pathname;
  const isAuthPage = pathname === "/auth";

  useEffect(() => {
    if (!isAuthPage && status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [isAuthPage, router, status]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenuPath(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  if (isAuthPage) return children;
  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Mengarahkan ke halaman masuk...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-3 text-sm font-semibold text-slate-950 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Lewati ke konten utama
      </a>
      <div className="flex min-h-screen">
        <AppSidebar
          mobileOpen={mobileMenuOpen}
          onNavigate={() => setOpenMenuPath(null)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            mobileMenuOpen={mobileMenuOpen}
            onToggleMobileMenu={() =>
              setOpenMenuPath((current) =>
                current === pathname ? null : pathname,
              )
            }
          />

          <main id="main-content" className="min-w-0 flex-1 bg-slate-50/60">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
