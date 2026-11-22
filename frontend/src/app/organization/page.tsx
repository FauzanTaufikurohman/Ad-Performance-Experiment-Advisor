"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  API,
  apiFetch,
  canAssignOrganizationOwner,
  canManageOrganizationMembers,
  canManagePlatformUsers,
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
  is_active: boolean;
  joined_at: string;
};

type ServiceIdentity = {
  id: number;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

type APIResponse<T> = {
  success: boolean;
  message?: string;
  organization?: T;
  role?: string;
  data?: T;
  token?: string;
  expires_at?: string;
  api_key?: string;
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
  auditor: "Auditor",
};

const organizationRoles = [
  { value: "organization_admin", label: "Organization Admin" },
  { value: "cmo_executive", label: "CMO / Executive" },
  { value: "marketing_manager", label: "Marketing Manager" },
  { value: "campaign_specialist", label: "Campaign Specialist" },
  { value: "data_analyst", label: "Data Analyst" },
  { value: "financial_controller", label: "Financial Controller" },
  { value: "auditor", label: "Auditor" },
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
  const [serviceIdentities, setServiceIdentities] = useState<ServiceIdentity[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("data_analyst");
  const [serviceName, setServiceName] = useState("");
  const [invitationLink, setInvitationLink] = useState("");
  const [newServiceKey, setNewServiceKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [changingUserID, setChangingUserID] = useState<number | null>(null);
  const [revokingServiceID, setRevokingServiceID] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [retry, setRetry] = useState(0);

  const canManageMembers = canManageOrganizationMembers(
    user?.organization_role,
  );
  const isPlatformAdmin = canManagePlatformUsers(user?.organization_role);
  const assignableRoles = canAssignOrganizationOwner(user?.organization_role)
    ? [
        { value: "organization_owner", label: "Organization Owner" },
        ...organizationRoles,
      ]
    : organizationRoles;

  useEffect(() => {
    let active = true;
    async function loadOrganization() {
      try {
        const [
          organizationResponse,
          membersResponse,
          serviceIdentitiesResponse,
        ] = await Promise.all([
          apiFetch(`${API}/api/organizations/current`, { cache: "no-store" }),
          apiFetch(`${API}/api/organizations/members`, { cache: "no-store" }),
          canManageMembers
            ? apiFetch(`${API}/api/organizations/service-identities`, {
                cache: "no-store",
              })
            : Promise.resolve(null),
        ]);
        const [
          organizationPayload,
          membersPayload,
          serviceIdentitiesPayload,
        ] = await Promise.all([
          organizationResponse.json() as Promise<APIResponse<OrganizationData>>,
          membersResponse.json() as Promise<APIResponse<OrganizationMember[]>>,
          serviceIdentitiesResponse
            ? (serviceIdentitiesResponse.json() as Promise<
                APIResponse<ServiceIdentity[]>
              >)
            : Promise.resolve<APIResponse<ServiceIdentity[]>>({
              success: true,
              data: [],
            }),
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
        if (canManageMembers && (
          !serviceIdentitiesResponse?.ok ||
          !serviceIdentitiesPayload.success ||
          !Array.isArray(serviceIdentitiesPayload.data)
        )) {
          throw new Error(
            serviceIdentitiesPayload.message ||
              "Service identity organisasi gagal dimuat.",
          );
        }

        if (!active) return;
        setOrganization(organizationPayload.organization);
        setMembers(membersPayload.data);
        setServiceIdentities(serviceIdentitiesPayload.data ?? []);
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
  }, [canManageMembers, retry]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    setInvitationLink("");

    try {
      const response = await apiFetch(`${API}/api/organizations/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const payload = (await response.json()) as APIResponse<never>;
      if (!response.ok || !payload.success || !payload.token) {
        throw new Error(payload.message || "Undangan gagal dibuat.");
      }

      const invitationURL = new URL("/invite/accept", window.location.origin);
      invitationURL.searchParams.set("token", payload.token);
      setInvitationLink(invitationURL.toString());
      setEmail("");
      setSuccess(payload.message || "Undangan berhasil dibuat.");
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

  async function changeUserStatus(member: OrganizationMember) {
    const nextIsActive = !member.is_active;
    const action = nextIsActive ? "mengaktifkan" : "menonaktifkan";
    if (!window.confirm(`Anda akan ${action} akun ${member.email} di seluruh platform. Lanjutkan?`)) {
      return;
    }

    setChangingUserID(member.id);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch(
        `${API}/api/platform/users/${member.id}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: nextIsActive }),
        },
      );
      const payload = (await response.json()) as APIResponse<never>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Status akun gagal diperbarui.");
      }
      setSuccess(payload.message || "Status akun diperbarui.");
      setLoading(true);
      setRetry((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Status akun gagal diperbarui.",
      );
    } finally {
      setChangingUserID(null);
    }
  }

  async function createServiceIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServiceSubmitting(true);
    setError("");
    setSuccess("");
    setNewServiceKey("");
    try {
      const response = await apiFetch(
        `${API}/api/organizations/service-identities`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: serviceName.trim() }),
        },
      );
      const payload =
        (await response.json()) as APIResponse<ServiceIdentity>;
      if (!response.ok || !payload.success || !payload.api_key) {
        throw new Error(
          payload.message || "Service identity gagal dibuat.",
        );
      }
      setNewServiceKey(payload.api_key);
      setServiceName("");
      setSuccess(payload.message || "Service identity berhasil dibuat.");
      setLoading(true);
      setRetry((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Service identity gagal dibuat.",
      );
    } finally {
      setServiceSubmitting(false);
    }
  }

  async function revokeServiceIdentity(identity: ServiceIdentity) {
    if (!window.confirm(`Cabut akses service identity "${identity.name}"?`)) {
      return;
    }
    setRevokingServiceID(identity.id);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch(
        `${API}/api/organizations/service-identities/${identity.id}/revoke`,
        { method: "POST" },
      );
      const payload = (await response.json()) as APIResponse<never>;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message || "Service identity gagal dicabut.",
        );
      }
      setSuccess(payload.message || "Service identity dicabut.");
      setLoading(true);
      setRetry((value) => value + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Service identity gagal dicabut.",
      );
    } finally {
      setRevokingServiceID(null);
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
        <p className="text-sm font-medium text-slate-600">
          {canManageMembers ? "Manage / Organization" : "Organization"}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {canManageMembers ? "Organisasi dan anggota" : "Informasi organisasi"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
          {canManageMembers
            ? "Kelola konteks organisasi dan lihat akses anggota pada workspace aktif."
            : "Lihat konteks organisasi aktif dan daftar anggotanya."}
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
                      className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_14rem]"
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
                      <div className="flex flex-col gap-2 sm:items-end">
                        <p className="text-sm font-medium text-slate-800">
                          {roleLabels[member.role] ?? member.role}
                        </p>
                        <p className="text-xs text-slate-700">
                          {member.is_active
                            ? "Akun aktif"
                            : "Akun dinonaktifkan"}
                        </p>
                        {isPlatformAdmin && member.id !== user?.id && (
                          <button
                            type="button"
                            onClick={() => void changeUserStatus(member)}
                            disabled={changingUserID === member.id}
                            className="min-h-11 rounded-md border border-slate-400 px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                          >
                            {changingUserID === member.id
                              ? "Menyimpan..."
                              : member.is_active
                                ? "Nonaktifkan akun"
                                : "Aktifkan akun"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {canManageMembers && (
              <form
                onSubmit={createInvitation}
                className="h-fit border-t border-slate-300 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
              >
                <h3 className="text-lg font-semibold text-slate-950">
                  Undang anggota
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Buat link sekali pakai untuk email dan role yang dipilih.
                  Kirim link lewat kanal tepercaya. Role Platform Super Admin
                  tidak dapat diberikan dari organisasi.
                </p>
                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-medium text-slate-900">
                    Email undangan
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
                  {submitting ? "Membuat undangan..." : "Buat undangan"}
                </button>
                {invitationLink && (
                  <div className="mt-4 space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-900">
                        Link undangan, hanya ditampilkan setelah dibuat
                      </span>
                      <textarea
                        readOnly
                        rows={3}
                        value={invitationLink}
                        className="w-full break-all rounded-md border border-slate-400 bg-white p-3 text-xs text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      />
                    </label>
                    <a
                      href={invitationLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      Buka link undangan
                    </a>
                  </div>
                )}
              </form>
            )}
          </section>

          {canManageMembers && (
            <section className="grid gap-8 border-t border-slate-300 pt-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-slate-950">
                  Identitas service
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                  Kunci berlaku hanya untuk organisasi aktif dan hanya dapat
                  membaca data. Simpan kunci saat dibuat. Sistem tidak dapat
                  menampilkannya kembali.
                </p>
                {serviceIdentities.length === 0 ? (
                  <p className="mt-4 border-y border-slate-300 py-5 text-sm text-slate-700">
                    Belum ada identitas service pada organisasi ini.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-slate-300 border-y border-slate-300">
                    {serviceIdentities.map((identity) => (
                      <li
                        key={identity.id}
                        className="flex flex-wrap items-start justify-between gap-3 py-4"
                      >
                        <div className="min-w-0">
                          <h4 className="break-words font-semibold text-slate-950">
                            {identity.name}
                          </h4>
                          <p className="mt-1 text-sm text-slate-700">
                            {identity.is_active ? "Aktif" : "Dicabut"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {identity.last_used_at
                              ? `Terakhir digunakan ${formatDate(identity.last_used_at)}`
                              : "Belum digunakan"}
                          </p>
                        </div>
                        {identity.is_active && (
                          <button
                            type="button"
                            onClick={() => void revokeServiceIdentity(identity)}
                            disabled={revokingServiceID === identity.id}
                            className="min-h-11 rounded-md border border-slate-400 px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                          >
                            {revokingServiceID === identity.id
                              ? "Mencabut..."
                              : "Cabut akses"}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form
                onSubmit={createServiceIdentity}
                className="h-fit border-t border-slate-300 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
              >
                <h4 className="text-lg font-semibold text-slate-950">
                  Buat identitas AI
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Identitas ini terpisah dari akun pengguna dan tidak dapat
                  mengunggah atau mengubah data.
                </p>
                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-medium text-slate-900">
                    Nama service
                  </span>
                  <input
                    required
                    maxLength={100}
                    value={serviceName}
                    onChange={(event) => setServiceName(event.target.value)}
                    className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  />
                </label>
                <button
                  type="submit"
                  disabled={serviceSubmitting}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
                >
                  {serviceSubmitting ? "Membuat identitas..." : "Buat identitas AI"}
                </button>
                {newServiceKey && (
                  <label className="mt-4 block">
                    <span className="mb-1 block text-sm font-medium text-slate-900">
                      API key, simpan sekarang
                    </span>
                    <textarea
                      readOnly
                      rows={3}
                      value={newServiceKey}
                      className="w-full break-all rounded-md border border-slate-400 bg-white p-3 font-mono text-xs text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    />
                  </label>
                )}
              </form>
            </section>
          )}
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
