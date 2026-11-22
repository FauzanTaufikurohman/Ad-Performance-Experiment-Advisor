# Akun Uji Berdasarkan Role

Dibuat pada 22 November 2026 pukul 13:37 WIB.

Halaman login: http://localhost:3000/auth

Gunakan akun ini hanya untuk pengujian lokal atau lingkungan non-produksi.

| Role | Nama | Email | Password | Organisasi aktif awal |
|---|---|---|---|---|
| organization_owner | Organization Owner | organization-owner-761f614f0f@advisora.local | Adv!761f614f0fORGA1 | Advisora QA 761f614f0f |
| organization_admin | Organization Admin | organization-admin-761f614f0f@advisora.local | Adv!761f614f0fORGA1 | Advisora QA 761f614f0f |
| cmo_executive | Cmo Executive | cmo-executive-761f614f0f@advisora.local | Adv!761f614f0fCMOA1 | Advisora QA 761f614f0f |
| marketing_manager | Marketing Manager | marketing-manager-761f614f0f@advisora.local | Adv!761f614f0fMARA1 | Advisora QA 761f614f0f |
| campaign_specialist | Campaign Specialist | campaign-specialist-761f614f0f@advisora.local | Adv!761f614f0fCAMA1 | Advisora QA 761f614f0f |
| data_analyst | Data Analyst | data-analyst-761f614f0f@advisora.local | Adv!761f614f0fDATA1 | Advisora QA 761f614f0f |
| financial_controller | Financial Controller | financial-controller-761f614f0f@advisora.local | Adv!761f614f0fFINA1 | Advisora QA 761f614f0f |
| platform_super_admin | Platform Super Admin | platform-super-admin-761f614f0f@advisora.local | Adv!761f614f0fPLAA1 | Semua organisasi |

## Organisasi Uji

- ID: ditetapkan otomatis oleh database
- Nama: `Advisora QA 761f614f0f`
- Organization Owner memiliki organisasi ini.
- Organization Admin, CMO Executive, Marketing Manager, Campaign Specialist, Data Analyst, dan Financial Controller telah ditambahkan sebagai anggota dengan role masing-masing.
- Platform Super Admin diprovisioning langsung pada tabel `platform_administrators` dan dapat memilih seluruh organisasi.

## Cara Menggunakan

1. Buka `http://localhost:3000/auth`.
2. Masuk memakai email dan password pada tabel.
3. Jika aplikasi belum aktif pada organisasi uji, pilih `Advisora QA 761f614f0f` pada pemilih organisasi.
4. Untuk Platform Super Admin, pilih organisasi yang ingin diuji dari pemilih organisasi.
