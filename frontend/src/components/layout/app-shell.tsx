
"use client";

import { Suspense } from "react";
import { useEffect } from "react";
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
  const isAuthPage = pathname === "/auth";

  useEffect(() => {
    if (!isAuthPage && status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [isAuthPage, router, status]);

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
      <div className="flex min-h-screen">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />

          <main className="min-w-0 flex-1 bg-slate-50/60">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
