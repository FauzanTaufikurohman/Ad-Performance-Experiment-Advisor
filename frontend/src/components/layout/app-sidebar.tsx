"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  canManageOrganizationMembers,
  canWriteCampaignData,
} from "@/lib/advisor";
import { getRoleExperience } from "@/lib/role-experience";

const navigation: Array<{
  label: string;
  items: Array<{
    label: string;
    href: string;
    requiresCampaignWrite?: boolean;
  }>;
}> = [
  {
    label: "Diagnose",
    items: [
      { label: "Overview", href: "/" },
      { label: "Campaign health", href: "/campaigns" },
      { label: "Scenario lab", href: "/scenarios" },
      { label: "Decision inbox", href: "/decisions" },
    ],
  },
  {
    label: "Evaluate",
    items: [
      { label: "Experiment lab", href: "/experiments" },
      { label: "Compare datasets", href: "/compare" },
    ],
  },
  {
    label: "Data",
    items: [
      { label: "Analysis history", href: "/history" },
      {
        label: "Import data",
        href: "/uploads/new",
        requiresCampaignWrite: true,
      },
    ],
  },
  {
    label: "Manage",
    items: [{ label: "Organization", href: "/organization" }],
  },
];

type AppSidebarProps = {
  mobileOpen: boolean;
  onNavigate: () => void;
};

export default function AppSidebar({
  mobileOpen,
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const experience = getRoleExperience(user);
  const canWrite = canWriteCampaignData(user?.organization_role);
  const canManageMembers = canManageOrganizationMembers(
    user?.organization_role,
  );
  const focusedPaths = new Set(experience.focusLinks.map((item) => item.href));
  const visibleNavigation = navigation
    .map((group) => ({
      ...group,
      sortLabel: group.label,
      items: group.items
        .filter(
          (item) =>
            (!item.requiresCampaignWrite || canWrite) &&
            !focusedPaths.has(item.href),
        )
        .map((item) => ({
          ...item,
          label:
            item.href === "/experiments" && !canWrite
              ? "Experiment history"
              : group.label === "Manage" && canManageMembers
                ? "Organization & members"
                : item.label,
        })),
      label:
        group.label === "Manage" && canManageMembers
          ? "Manage"
          : group.label === "Manage"
            ? "Organization"
            : group.label,
    }))
    .filter((group) => group.items.length > 0)
    .sort(
      (left, right) =>
        (experience.navigationOrder.indexOf(left.sortLabel) < 0
          ? Number.MAX_SAFE_INTEGER
          : experience.navigationOrder.indexOf(left.sortLabel)) -
        (experience.navigationOrder.indexOf(right.sortLabel) < 0
          ? Number.MAX_SAFE_INTEGER
          : experience.navigationOrder.indexOf(right.sortLabel)),
    );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={onNavigate}
          className="fixed inset-x-0 bottom-0 top-[72px] z-30 bg-slate-950/25 md:hidden"
        />
      )}

      <aside
        id="primary-navigation"
        aria-label="Navigasi utama"
        className={`${
          mobileOpen ? "fixed flex" : "hidden md:flex"
        } inset-y-0 left-0 z-40 w-[min(18rem,88vw)] flex-col border-r border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0`}
        style={mobileOpen ? { top: 72, height: "calc(100dvh - 72px)" } : undefined}
      >
        <Link
          href="/"
          onClick={onNavigate}
          className="flex h-[72px] shrink-0 items-center gap-3 border-b border-slate-200 px-5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-lg font-bold text-white">
            A
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight text-slate-900">
              Advisora
            </span>
            <span className="mt-0.5 block text-xs text-slate-600">
              Campaign operations
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          <section aria-labelledby="nav-role-focus">
            <h2
              id="nav-role-focus"
              className="mb-2 px-3 text-xs font-semibold text-slate-600"
            >
              Fokus: {experience.label}
            </h2>
            <ul className="space-y-1">
              {experience.focusLinks
                .filter((item) => item.href !== "/uploads/new" || canWrite)
                .map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                        active
                          ? "bg-blue-50 font-semibold text-blue-800"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          {visibleNavigation.map((group) => (
            <section key={group.label} aria-labelledby={`nav-${group.label}`}>
              <h2
                id={`nav-${group.label}`}
                className="mb-2 px-3 text-xs font-semibold text-slate-600"
              >
                {group.label}
              </h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                          active
                            ? "bg-blue-50 font-semibold text-blue-800"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-700">
            Data source: CSV uploads
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Analisis mengikuti data yang tersimpan di workspace Anda.
          </p>
        </div>
      </aside>
    </>
  );
}
