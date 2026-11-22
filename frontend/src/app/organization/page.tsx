"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  API,
  apiFetch,
} from "@/lib/advisor";
import { useAuth } from "@/components/auth/auth-provider";

type OrganizationData = {
  id: number;
  name: string;
  created_at: string;
  default_workspace: string;
};

type OrganizationMember = {
  id: number;
  name: string;
  email: string;
  role: string;
  joined_at: string;
};

type APIResponse<T> = {
  success: boolean;
  message?: string;
  organization?: T;
  role?: string;
  data?: T;
};

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

const organizationRoles = [
  { value: "organization_admin", label: "Organization Admin" },
  { value: "cmo_executive", label: "CMO / Executive" },
  { value: "marketing_manager", label: "Marketing Manager" },
  { value: "campaign_specialist", label: "Campaign Specialist" },
  { value: "data_analyst", label: "Data Analyst" },
  { value: "financial_controller", label: "Financial Controller" },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

export default function OrganizationPage() {
  const { user, organizations, switchOrganization } = useAuth();
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("data_analyst");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [retry, setRetry] = useState(0);

  const canManageMembers =
    user?.organization_role === "platform_super_admin" ||
    user?.organization_role === "organization_owner" ||
    user?.organization_role === "organization_admin";
  const assignableRoles =
    user?.organization_role === "platform_super_admin" ||
    user?.organization_role === "organization_owner"
      ? [
          { value: "organization_owner", label: "Organization Owner" },
          ...organizationRoles,
        ]
      : organizationRoles;

  useEffect(() => {
    let active = true;
    async function loadOrganization() {
      try {
        const [organizationResponse, membersResponse] = await Promise.all([
          apiFetch(`${API}/api/organizations/current`, { cache: "no-store" }),
          apiFetch(`${API}/api/organizations/members`, { cache: "no-store" }),
        ]);
        const [organizationPayload, membersPayload] = await Promise.all([
          organizationResponse.json() as Promise<APIResponse<OrganizationData>>,
          membersResponse.json() as Promise<APIResponse<OrganizationMember[]>>,
        ]);

        if (
          !organizationResponse.ok ||
          !organizationPayload.success ||
          !organizationPayload.organization
        ) {
          throw new Error(
            organizationPayload.message || "Informasi organisasi gagal dimuat.",
          );
        }
        if (
          !membersResponse.ok ||
          !membersPayload.success ||
          !Array.isArray(membersPayload.data)
        ) {
          throw new Error(
            membersPayload.message || "Anggota organisasi gagal dimuat.",
          );
        }

        if (!active) return;
        setOrganization(organizationPayload.organization);
        setMembers(membersPayload.data);
        setError("");
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Informasi organisasi gagal dimuat.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOrganization();
    return () => {
      active = false;
    };
  }, [retry]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(`${API}/api/organizations/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const payload = (await response.json()) as APIResponse<never>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Anggota gagal ditambahkan.");
      }

      setEmail("");
      setSuccess(payload.message || "Anggota berhasil ditambahkan.");
      setLoading(true);
      setRetry((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Anggota gagal ditambahkan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function changeOrganization(value: string) {
    const organizationId = Number(value);
    if (!organizationId || organizationId === user?.organization_id) return;

    setSwitching(true);
    setError("");
    try {
      await switchOrganization(organizationId);
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Organisasi gagal diganti.",
      );
      setSwitching(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-7 sm:py-8">
      <header>
        <p className="text-sm font-medium text-slate-600">Manage / Organization</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Organisasi dan anggota
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
          Kelola konteks organisasi dan lihat akses anggota pada workspace aktif.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          <p>{error}</p>
          {!loading && (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                setRetry((value) => value + 1);
              }}
              className="mt-3 min-h-11 rounded-md border border-red-400 bg-white px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
            >
              Muat ulang
            </button>
          )}
        </div>
      )}

      {success && (
        <p
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"
        >
          {success}
        </p>
      )}

      {loading ? (
        <p role="status" className="rounded-md border border-slate-300 bg-white p-5 text-sm text-slate-800">
          Memuat informasi organisasi dan anggota...
        </p>
      ) : organization ? (
        <>
          <section className="grid gap-6 border-y border-slate-300 py-6 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">Organisasi aktif</p>
              <h3 className="mt-2 break-words text-2xl font-semibold text-slate-950">
                {organization.name}
              </h3>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-slate-600">Role Anda</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-950">
                    {roleLabels[user?.organization_role ?? ""] ??
                      user?.organization_role ??
                      "Tidak diketahui"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-600">Workspace awal</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-slate-950">
                    {organization.default_workspace}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-600">Dibuat</dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {formatDate(organization.created_at)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-slate-300 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              {organizations.length > 1 ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">
                    Ganti organisasi aktif
                  </span>
                  <select
                    value={String(user?.organization_id ?? "")}
                    disabled={switching}
                    onChange={(event) =>
                      void changeOrganization(event.target.value)
                    }
                    className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-slate-100"
                  >
                    {organizations.map((membership) => (
                      <option key={membership.id} value={String(membership.id)}>
                        {membership.name}
                      </option>
                    ))}
                  </select>
                  {switching && (
                    <span role="status" className="mt-2 block text-sm text-slate-700">
                      Mengganti organisasi...
                    </span>
                  )}
                </label>
              ) : (
                <p className="text-sm leading-6 text-slate-700">
                  Akun ini memiliki akses ke satu organisasi.
                </p>
              )}
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-950">Anggota</h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {members.length} akun terdaftar pada organisasi ini.
                  </p>
                </div>
              </div>

              {members.length === 0 ? (
                <p className="mt-4 border-y border-slate-300 py-5 text-sm text-slate-700">
                  Belum ada anggota organisasi.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-300 border-y border-slate-300">
                  {members.map((member) => (
                    <article
                      key={member.id}
                      className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_12rem]"
                    >
                      <div className="min-w-0">
                        <h4 className="break-words font-semibold text-slate-950">
                          {member.name}
                        </h4>
                        <p className="break-all text-sm text-slate-700">{member.email}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Bergabung {formatDate(member.joined_at)}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-slate-800 sm:text-right">
                        {roleLabels[member.role] ?? member.role}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {canManageMembers && (
              <form
                onSubmit={addMember}
                className="h-fit border-t border-slate-300 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
              >
                <h3 className="text-lg font-semibold text-slate-950">
                  Tambahkan anggota
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Anggota harus sudah memiliki akun Advisora. Role Super Admin
                  dikelola terpisah dan tidak dapat diberikan dari organisasi.
                </p>
                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-medium text-slate-900">
                    Email akun
                  </span>
                  <input
                    type="email"
                    required
                    maxLength={255}
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-h-11 w-full rounded-md border border-slate-400 px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-medium text-slate-900">
                    Role
                  </span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    {assignableRoles.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
                >
                  {submitting ? "Menambahkan..." : "Tambahkan anggota"}
                </button>
              </form>
            )}
          </section>
        </>
      ) : (
        !error && (
          <p className="rounded-md border border-slate-300 bg-white p-5 text-sm text-slate-800">
            Informasi organisasi belum tersedia.
          </p>
        )
      )}
    </div>
  );
}
