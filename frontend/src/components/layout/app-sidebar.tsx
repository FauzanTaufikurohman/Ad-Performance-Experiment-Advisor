
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Overview", href: "/", icon: "▦" },
      { label: "Import Data", href: "/uploads/new", icon: "↑" },
      { label: "Analysis History", href: "/history", icon: "◷" },
      { label: "Experiments", href: "/experiments", icon: "◇" },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link href="/" className="flex h-[72px] items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white">
          A
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900">
            Advisora
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Ads intelligence
          </p>
        </div>
      </Link>

      <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
        {navigation.map((group) => (
          <div key={group.label}>
            <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-400">
              {group.label}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-base">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">
            Ad Performance Advisor
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Analyze performance. Discover experiments.
          </p>
        </div>
      </div>
    </aside>
  );
}
