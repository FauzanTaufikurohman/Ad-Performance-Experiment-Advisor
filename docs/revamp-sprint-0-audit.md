# Advisora Revamp: Audit Sprint 0

Tanggal: 22 November 2026  
Status: Audit awal selesai; Sprint 1 dapat dimulai dengan backlog dan blocker yang tercatat.

## Ringkasan

Blueprint menetapkan target Advisora sebagai platform enterprise marketing intelligence multi-tenant dengan AI berbasis bukti dan otonomi yang dibatasi policy. Sprint Plan menetapkan Sprint 0 untuk discovery, audit, risk register, backlog prioritas, dan keputusan teknis sebelum delivery 12 sprint.

Repositori saat ini sudah memiliki analisis CSV, autentikasi dan organisasi, role, dashboard, AI Advisor opsional, serta evaluasi Bayesian. Fitur tersebut menjadi baseline yang dipertahankan selama migrasi. Konektor iklan, finansial, governance otonomi, dan kesiapan produksi belum tersedia.

## Arsitektur saat ini

```text
Browser
  └── Next.js 16 + React + TypeScript
       └── HTTP API, bearer token
            └── Go + Gin
                 ├── Auth, organization, role middleware
                 ├── CSV validation, metrics, findings, readiness
                 ├── Optional AI Advisor
                 ├── Bayesian experiment service
                 └── PostgreSQL via pgx pool
```

### Komponen dan batas saat ini

| Area | Kondisi sekarang |
|---|---|
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, halaman dashboard dan analisis |
| API | Go dan Gin, route handlers, middleware autentikasi dan role |
| Data store | PostgreSQL, koneksi pgx pool, migrasi SQL berurutan 001–007 |
| Ingestion | CSV kampanye; belum ada konektor provider atau background sync worker |
| Identity | Pengguna aktif/nonaktif, organisasi, membership, workspace default, role organisasi termasuk Auditor, Platform Super Admin, undangan sekali pakai, dan service identity read-only |
| Analytics | Metrik, findings, readiness, Bayesian CTR/CVR, perbandingan dataset |
| AI | AI Advisor opsional; belum ada orchestrator multi-agent atau service identity terpisah |
| Deployment | Instruksi lokal di README; belum ditemukan workflow CI, Dockerfile, atau Compose |
| Observability | Health live/ready dan structured server logs dasar; belum ada tracing, SLO, dashboard, atau alert |

## Keputusan awal

### ADR-001: Pertahankan modular monolith untuk fase fondasi

Keputusan: lanjutkan Go/Gin, Next.js, dan PostgreSQL yang ada. Jangan memecah service sebelum batas domain, volume, atau kebutuhan deployment membenarkannya.

Alasan: ini mempertahankan perilaku yang sudah berjalan dan menghindari migrasi arsitektur sebelum domain provider dan kebutuhan skala tervalidasi.

### ADR-002: Pertahankan CSV sebagai jalur kompatibilitas

Keputusan: pertahankan alur CSV dan histori yang ada ketika menambah model iklan canonical dan provider framework.

Alasan: Sprint Plan meminta migrasi backward-compatible. Data CSV tetap harus dapat ditelusuri dan tidak boleh diganti dengan data provider simulasi.

### ADR-003: Autonomy tetap read-only sampai release gate lulus

Keputusan: tidak menambah aksi tulis provider sebelum policy, approval, kill switch, idempotency, audit, verifikasi state provider, dan recovery teruji.

Alasan: blueprint menempatkan AI sebagai planner, bukan sumber otoritas izin atau batas finansial.

### ADR-004: Migrasi database eksplisit

Keputusan: migrasi dijalankan melalui perintah operator, bukan otomatis saat API startup.

Alasan: database lama belum memiliki migration ledger; menjalankan semua skrip dari awal pada database yang sudah berisi data berisiko mengulang perubahan.

## Risk register

| ID | Risiko | Tingkat | Mitigasi / pemilik berikutnya |
|---|---|---|---|
| R-01 | Nilai kredensial provider AI ditemukan pada file environment lokal. Nilainya tidak dicatat di dokumen ini. | Tinggi | Perlakukan sebagai terekspos, rotasi di provider, pastikan file tetap di-ignore, dan gunakan secret store untuk environment bersama. Owner: pemilik environment. |
| R-02 | Workflow CI sudah dibuat, tetapi belum ada bukti hosted run atau dependency scan sebelum merge. | Tinggi | Jalankan dan perbaiki workflow pada pull request; pantau hasil scan. Owner: engineering/DevOps. |
| R-03 | Tenant scoping berada pada middleware dan query aplikasi; belum ada bukti RLS atau test lintas tenant yang mencakup semua domain. | Tinggi | Buat matriks tenant ownership, cross-tenant tests, lalu evaluasi PostgreSQL RLS sebagai defense-in-depth. Owner: backend/QA. |
| R-04 | Migrasi SQL dijalankan manual dan tidak memiliki ledger versi di database. | Tinggi | Tambahkan runner eksplisit untuk database kosong dan adoption procedure terkontrol untuk database lama. Jangan replay migrasi pada database lama tanpa verifikasi. Owner: backend/DBA. |
| R-05 | Integrasi Meta/Google dan detail OAuth/token lifecycle belum ada. | Tinggi | Minta akses provider dan scopes di discovery; rancang encrypted credentials sebelum Sprint 4. Owner: PO/Integration. |
| R-06 | AI Advisor belum memiliki agent service identity, tool allowlist, policy version, atau evidence ledger sesuai target. | Tinggi | Pertahankan AI read-only dan catat data sumber/model/prompt sebelum menambah tools atau tindakan. Owner: AI/Data. |
| R-07 | Forecasting, budget model, finance approvals, dan data profitability belum tersedia. | Sedang | Sepakati definisi KPI, currency, timezone, attribution, dan finance data sebelum Sprint 8. Owner: PO/Finance. |
| R-08 | Auditor, AI service identity, user disable lifecycle, dan invitation flow belum tersedia. | Sedang | Validasi kebutuhan dan privilege model sebelum memperluas RBAC pada Sprint 2. Owner: PO/Security. |
| R-09 | API error envelope, request ID, versioning, migration validation, and dependency checks belum konsisten atau belum tersedia. | Sedang | Tetapkan kontrak API sebelum merombak handlers; sertakan log correlation dan test. Owner: Tech Lead. |

## Peta sprint

| Sprint | Status baseline | Exit utama dari Sprint Plan |
|---|---|---|
| 0 Discovery & audit | Audit awal ini selesai, beberapa dependency dan risk masih perlu konfirmasi pemilik | Risk register, ADR, backlog prioritas, Sprint 1 siap |
| 1 Engineering foundation | Sebagian dikerjakan | CI workflow dan migration runner tersedia; validasi workflow, dependency scan, API conventions, dan readiness masih perlu dibuktikan |
| 2 Identity, tenant & RBAC | Implementasi lokal, acceptance menunggu verifikasi CI PostgreSQL | Cross-tenant tests, disabled user, invitations, service identity, audit |
| 3 Data model & governance | Sebagian tersedia | ERD, canonical contracts, audit ledger, migration runbook |
| 4 Provider framework & Meta | Belum dimulai | Connect/sync Meta end-to-end, idempotency, freshness, isolation |
| 5 Google Ads & metrics | Belum dimulai | Google sync dan metric normalization/reconciliation |
| 6 Performance dashboard | Sebagian tersedia | Provider/date filters, drill-down, freshness, export, role views |
| 7 AI insight & diagnostics | Sebagian tersedia | Evidence-linked read-only insight dan evaluation set |
| 8 Forecast & budget simulation | Belum dimulai | Deterministic forecast, simulator, assumptions dan financial view |
| 9 Policy, approval & autonomy | Belum dimulai | Policy engine, approval, kill switch, immutable audit |
| 10 Controlled execution | Belum dimulai | Allowlisted action, approval, idempotency, verification, recovery |
| 11 Experiments & provider expansion | Sebagian tersedia | Experiment registry, creative metadata, TikTok, LinkedIn assessment |
| 12 Enterprise hardening | Belum dimulai | Observability, DR, security, load, accessibility, UAT, release |

Status di atas adalah pemetaan awal dari repo, bukan acceptance sign-off sprint. Baseline tim dan estimasi 24 minggu pada Sprint Plan perlu dikonfirmasi terhadap kapasitas dan akses provider.

## Backlog Sprint 1

### P0: CI dan quality gates

- Backend: gofmt check, `go test ./...`, `go vet ./...`, migration validation pada PostgreSQL kosong, dependency scan.
- Frontend: `npm ci`, lint, TypeScript check, production build, dependency scan.
- Acceptance: workflow berjalan pada pull request; kegagalan command menggagalkan job; tidak memerlukan credential produksi.
- Status lokal: test Go, vet, gofmt, lint, TypeScript, dan production build lulus. Hosted workflow serta dependency scan belum dijalankan.

### P0: Migration runner dan validasi

- Tambah perintah migrasi eksplisit yang mengurutkan skrip dan merekam versi/checksum.
- Jalankan migrasi terhadap database kosong di CI.
- Runner menolak database yang memiliki tabel aplikasi tetapi tidak memiliki migration ledger. Adoption database lama memerlukan schema comparison dan prosedur eksplisit yang belum disediakan.
- Acceptance: migration error terlihat; skrip yang sudah tercatat tidak dijalankan ulang; API startup tidak memutasi schema.
- Status lokal: ketujuh migration diterapkan pada PostgreSQL sementara yang kosong; rerun tidak mengulang perubahan; database sementara berisi tabel tanpa ledger ditolak tanpa membuat ledger.

### P1: API conventions

- Dokumentasikan error envelope, pagination, request ID, versioning, dan aturan log.
- Tentukan jalur transisi agar kontrak lama tidak rusak tanpa versi baru.
- Acceptance: contoh kontrak dan test untuk endpoint yang disentuh; tidak ada secret atau payload sensitif dalam log.

### P1: Environment dan health checks

- Validasi konfigurasi wajib saat startup dan dokumentasikan perbedaan dev/staging/prod.
- Pertahankan live dan ready probes, lalu tambahkan smoke test untuk readiness di CI.
- Acceptance: service gagal dengan pesan eksplisit bila konfigurasi wajib tidak ada; ready berstatus gagal saat PostgreSQL tidak tersedia.

## Delivery Sprint 2: Identity, tenant & RBAC

### Perubahan yang diterapkan

- Migration `008_identity_lifecycle.sql` menambah status aktif akun, Auditor, undangan, service identity, dan audit scope platform.
- Login serta middleware memblokir akun nonaktif. Sesi yang sudah diterbitkan diperiksa kembali pada setiap request.
- Platform Super Admin dapat mengaktifkan atau menonaktifkan akun. API menolak penonaktifan akun sendiri dan Platform Super Admin aktif terakhir.
- Owner, Admin, dan Platform Super Admin dapat membuat undangan berumur tujuh hari. Token acak disimpan sebagai hash, terikat ke email dan organisasi, hanya bisa diterima sekali, dan tidak dapat memberikan role Owner atau Platform Super Admin.
- Karena email provider belum tersedia, halaman organisasi menampilkan link undangan satu kali untuk dikirim melalui kanal tepercaya.
- Service identity memakai key terpisah dari sesi pengguna, dibatasi ke satu organisasi, read-only, dan dapat dicabut. Sistem hanya menyimpan hash key dan menampilkannya sekali.
- Auditor hanya dapat membaca data tenant aktif. Operasi pengguna dan service identity tetap terbatas pada principal manusia dengan role pengelola yang sesuai.
- Audit event mencatat login berhasil, pembuatan/penerimaan undangan, perubahan status akun, serta pembuatan/pencabutan service identity.
- Integration test memeriksa pembacaan lintas tenant, token dengan organisasi yang tidak dimiliki, batas Auditor, service identity read-only, dan pemblokiran token pengguna nonaktif.

### API dan acceptance

- `POST /api/organizations/invitations`
- `POST /api/auth/invitations/accept`
- `POST /api/platform/users/:id/status`
- `GET|POST /api/organizations/service-identities`
- `POST /api/organizations/service-identities/:id/revoke`
- Test integrasi memakai `TEST_DATABASE_URL` khusus dan migration runner. CI mengarahkannya ke layanan PostgreSQL sementara, kemudian menjalankan migrasi ulang sebagai validasi idempotensi.
- Status verifikasi lokal saat dokumen diperbarui: unit test Go lulus; test integrasi PostgreSQL belum dijalankan jika `TEST_DATABASE_URL` tidak tersedia. Hosted CI belum dijalankan.

## Batas scope dan dependency

- Sprint berikutnya tidak boleh mengirim campaign changes ke provider.
- Konektor bergantung pada credential, scopes, account uji, rate limit, dan provider approval.
- Canonical metric bergantung pada definisi conversion, currency, timezone, attribution, dan missing-data semantics.
- Database lama belum memiliki prosedur adoption; jangan jalankan runner database kosong ke database tersebut.
- Perubahan UI mengikuti [DESIGN.md](../DESIGN.md) dan release gate aksesibilitas.
- Undangan memakai pengiriman link manual sampai provider email dan secret delivery disetujui; jangan menganggap undangan terkirim otomatis.
