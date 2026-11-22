import type { AuthUser } from "./advisor";

type RoleFocusLink = {
  label: string;
  href: string;
  description: string;
};

type RoleExperience = {
  label: string;
  focusHeading: string;
  focusDescription: string;
  focusLinks: RoleFocusLink[];
  navigationOrder: string[];
};

const defaultExperience: RoleExperience = {
  label: "Organization member",
  focusHeading: "Tinjau performa organisasi",
  focusDescription:
    "Mulai dari data yang tersedia, lalu buka analisis yang membantu pekerjaan Anda.",
  focusLinks: [
    {
      label: "Riwayat analisis",
      href: "/history",
      description: "Buka dataset dan analisis yang tersimpan.",
    },
    {
      label: "Decision inbox",
      href: "/decisions",
      description: "Tinjau temuan dan rekomendasi lintas dataset.",
    },
  ],
  navigationOrder: ["Diagnose", "Data", "Evaluate", "Manage"],
};

const experiences: Record<string, RoleExperience> = {
  organization_owner: {
    label: "Organization Owner",
    focusHeading: "Pimpin organisasi dan tinjau hasil",
    focusDescription:
      "Atur akses tim, lalu tinjau temuan yang perlu dibawa ke keputusan organisasi.",
    focusLinks: [
      {
        label: "Anggota dan akses",
        href: "/organization",
        description: "Tinjau anggota dan kelola akses organisasi.",
      },
      {
        label: "Decision inbox",
        href: "/decisions",
        description: "Prioritaskan temuan dari seluruh dataset organisasi.",
      },
    ],
    navigationOrder: ["Manage", "Diagnose", "Data", "Evaluate"],
  },
  organization_admin: {
    label: "Organization Admin",
    focusHeading: "Jaga akses tim dan operasi data",
    focusDescription:
      "Kelola keanggotaan organisasi dan bantu tim menjaga alur analisis tetap berjalan.",
    focusLinks: [
      {
        label: "Anggota dan akses",
        href: "/organization",
        description: "Undang anggota dan kelola role yang tersedia.",
      },
      {
        label: "Riwayat analisis",
        href: "/history",
        description: "Pantau dataset yang sudah masuk ke organisasi.",
      },
    ],
    navigationOrder: ["Manage", "Data", "Diagnose", "Evaluate"],
  },
  cmo_executive: {
    label: "CMO / Executive",
    focusHeading: "Tentukan prioritas kampanye",
    focusDescription:
      "Mulai dari temuan lintas dataset, lalu telusuri kesehatan kampanye yang membutuhkan perhatian.",
    focusLinks: [
      {
        label: "Decision inbox",
        href: "/decisions",
        description: "Tinjau temuan dan rekomendasi yang tersimpan.",
      },
      {
        label: "Campaign health",
        href: "/campaigns",
        description: "Bandingkan kondisi kampanye dari data aktual.",
      },
    ],
    navigationOrder: ["Diagnose", "Evaluate", "Data", "Manage"],
  },
  marketing_manager: {
    label: "Marketing Manager",
    focusHeading: "Ubah temuan menjadi rencana uji",
    focusDescription:
      "Bandingkan periode kampanye dan siapkan evaluasi varian berdasarkan hipotesis tim.",
    focusLinks: [
      {
        label: "Experiment lab",
        href: "/experiments",
        description: "Evaluasi varian dan tinjau riwayat eksperimen.",
      },
      {
        label: "Bandingkan dataset",
        href: "/compare",
        description: "Periksa perubahan metrik antar dataset.",
      },
    ],
    navigationOrder: ["Evaluate", "Diagnose", "Data", "Manage"],
  },
  campaign_specialist: {
    label: "Campaign Specialist",
    focusHeading: "Siapkan data untuk diagnosis",
    focusDescription:
      "Impor data kampanye, lalu periksa hasil validasi dan temuan yang dihasilkan.",
    focusLinks: [
      {
        label: "Impor data",
        href: "/uploads/new",
        description: "Unggah CSV kampanye ke organisasi aktif.",
      },
      {
        label: "Riwayat analisis",
        href: "/history",
        description: "Buka kembali dataset dan analisis sebelumnya.",
      },
    ],
    navigationOrder: ["Data", "Diagnose", "Evaluate", "Manage"],
  },
  data_analyst: {
    label: "Data Analyst",
    focusHeading: "Validasi data dan ukur varian",
    focusDescription:
      "Bandingkan dataset, cek kesiapan data, dan evaluasi hasil eksperimen.",
    focusLinks: [
      {
        label: "Experiment lab",
        href: "/experiments",
        description: "Evaluasi CTR atau CVR dan baca ketidakpastiannya.",
      },
      {
        label: "Bandingkan dataset",
        href: "/compare",
        description: "Periksa konsistensi metrik antar dataset.",
      },
    ],
    navigationOrder: ["Evaluate", "Data", "Diagnose", "Manage"],
  },
  financial_controller: {
    label: "Financial Controller",
    focusHeading: "Tinjau dampak biaya kampanye",
    focusDescription:
      "Tinjau metrik belanja dan temuan risiko untuk menyiapkan evaluasi anggaran kampanye.",
    focusLinks: [
      {
        label: "Campaign health",
        href: "/campaigns",
        description: "Tinjau metrik kampanye yang tersedia.",
      },
      {
        label: "Decision inbox",
        href: "/decisions",
        description: "Baca risiko dan rekomendasi dari dataset.",
      },
    ],
    navigationOrder: ["Diagnose", "Data", "Evaluate", "Manage"],
  },
  auditor: {
    label: "Auditor",
    focusHeading: "Telusuri data dan hasil tersimpan",
    focusDescription:
      "Telusuri riwayat dataset, analisis, dan temuan dalam organisasi aktif.",
    focusLinks: [
      {
        label: "Riwayat analisis",
        href: "/history",
        description: "Telusuri dataset dan analisis yang tersimpan.",
      },
      {
        label: "Decision inbox",
        href: "/decisions",
        description: "Baca temuan dan rekomendasi lintas dataset.",
      },
    ],
    navigationOrder: ["Data", "Diagnose", "Evaluate", "Manage"],
  },
  platform_super_admin: {
    label: "Platform Super Admin",
    focusHeading: "Awasi organisasi yang sedang dipilih",
    focusDescription:
      "Periksa akses organisasi aktif dan tinjau kondisi kampanye dalam konteks tersebut.",
    focusLinks: [
      {
        label: "Organisasi dan anggota",
        href: "/organization",
        description: "Tinjau atau kelola akses organisasi aktif.",
      },
      {
        label: "Decision inbox",
        href: "/decisions",
        description: "Tinjau temuan dalam organisasi aktif.",
      },
    ],
    navigationOrder: ["Manage", "Diagnose", "Evaluate", "Data"],
  },
};

export function getRoleExperience(user: AuthUser | null): RoleExperience {
  if (!user) return defaultExperience;
  return experiences[user.organization_role] ?? defaultExperience;
}
