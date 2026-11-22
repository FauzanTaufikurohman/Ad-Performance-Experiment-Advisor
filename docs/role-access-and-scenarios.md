# Matriks Fitur dan Hak Akses Role Advisora

Dokumen ini menjelaskan pembagian akses berdasarkan implementasi backend dan frontend Advisora saat ini.

## 1. Gambaran Sistem

Advisora adalah aplikasi analisis performa kampanye berbasis CSV. Pengguna:

- membuat organisasi dan workspace;
- mengunggah data kampanye;
- melihat metrik dan temuan;
- menjalankan AI Advisor;
- membandingkan dataset;
- mengevaluasi eksperimen CTR atau CVR secara Bayesian;
- mengelola anggota organisasi.

Semua data dibaca dan ditulis dalam konteks organisasi aktif. Pengguna hanya dapat mengakses upload, temuan, dan riwayat eksperimen milik organisasi aktif. Pergantian organisasi menghasilkan token sesi baru.

Navigasi dan ringkasan halaman awal disesuaikan dengan fokus role. Fitur yang
tidak diizinkan disembunyikan dari navigasi dan kontrol frontend; backend tetap
menjadi sumber penegakan izin untuk setiap operasi.

## 2. Role yang Tersedia

| Role | Kategori | Ringkas |
|---|---|---|
| organization_owner | Organisasi | Pemilik organisasi, pengelola tertinggi dalam satu organisasi |
| organization_admin | Organisasi | Administrator operasi dan pengelolaan anggota |
| cmo_executive | Operasional-strategis | Eksekutif yang dapat meninjau dan menjalankan analisis |
| marketing_manager | Operasional-strategis | Mengelola data dan keputusan kampanye |
| campaign_specialist | Operasional | Mengunggah dan menganalisis data kampanye |
| data_analyst | Operasional-teknis | Mengolah data, menjalankan analisis, dan mengevaluasi eksperimen |
| financial_controller | Read-only | Meninjau hasil dan riwayat, tetapi tidak mengubah data atau menjalankan analisis tulis |
| auditor | Read-only | Meninjau data organisasi tanpa akses tulis atau pengelolaan anggota |
| platform_super_admin | Platform | Admin terpisah yang dapat memilih semua organisasi |
| ai_service_identity | Identitas service | Identitas mesin per organisasi untuk pembacaan data, terpisah dari akun pengguna |

## 3. Pembagian Hak Akses

### Matriks fitur utama

| Fitur | Owner | Admin | CMO | Marketing Manager | Campaign Specialist | Data Analyst | Financial Controller | Platform Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Masuk dan mengganti organisasi terdaftar | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Melihat detail organisasi aktif | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Melihat anggota organisasi | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Menambah anggota | Ya | Ya | Tidak | Tidak | Tidak | Tidak | Tidak | Ya |
| Menetapkan Organization Owner | Ya | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak | Ya |
| Menetapkan role Admin dan role operasional | Ya | Ya | Tidak | Tidak | Tidak | Tidak | Tidak | Ya |
| Mengunggah CSV | Ya | Ya | Ya | Ya | Ya | Ya | Tidak | Ya |
| Melihat riwayat dataset | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Membuka detail analisis dataset | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Melihat Campaign Health | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Melihat Scenario Lab | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Melihat Decision Inbox | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Membandingkan dua dataset | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |
| Menjalankan AI Advisor | Ya | Ya | Ya | Ya | Ya | Ya | Tidak | Ya |
| Menjalankan Bayesian CTR/CVR | Ya | Ya | Ya | Ya | Ya | Ya | Tidak | Ya |
| Menjalankan Monte Carlo | Ya | Ya | Ya | Ya | Ya | Ya | Tidak | Ya |
| Melihat riwayat eksperimen | Ya | Ya | Ya | Ya | Ya | Ya | Ya | Ya |

Auditor memiliki akses baca ke fitur yang bertanda Ya untuk Financial Controller. Auditor tidak dapat menambah anggota, mengunggah CSV, menjalankan AI Advisor, atau menjalankan eksperimen. Identitas AI bukan membership manusia dan hanya dapat memakai endpoint baca pada organisasi tempat key dibuat.

### Matriks endpoint

| Operasi | Endpoint | Role yang diizinkan |
|---|---|---|
| Registrasi dan login | POST /api/auth/register, POST /api/auth/login | Semua pengguna |
| Sesi aktif | GET /api/auth/me | Pengguna terautentikasi |
| Pemilihan organisasi | POST /api/auth/organizations/select | Anggota organisasi atau Platform Super Admin |
| Informasi organisasi | GET /api/organizations/current | Semua role terautentikasi |
| Daftar anggota | GET /api/organizations/members | Semua role terautentikasi |
| Tambah anggota | POST /api/organizations/members | Owner, Admin, Platform Super Admin |
| Membuat undangan anggota | POST /api/organizations/invitations | Owner, Admin, Platform Super Admin |
| Menerima undangan | POST /api/auth/invitations/accept | Pemegang token undangan sekali pakai |
| Mengaktifkan atau menonaktifkan akun | POST /api/platform/users/:id/status | Platform Super Admin |
| Membuat dan mencabut identitas service | POST /api/organizations/service-identities, POST /api/organizations/service-identities/:id/revoke | Owner, Admin, Platform Super Admin |
| Membaca identitas service organisasi | GET /api/organizations/service-identities | Owner, Admin, Platform Super Admin |
| Unggah CSV | POST /api/uploads | Owner, Admin, CMO, Marketing Manager, Campaign Specialist, Data Analyst, Platform Super Admin |
| Riwayat dan detail upload | GET /api/uploads, GET /api/uploads/:id | Semua role terautentikasi |
| Decision Inbox | GET /api/decisions | Semua role terautentikasi |
| AI Advisor | POST /api/ai/analyze | Owner, Admin, CMO, Marketing Manager, Campaign Specialist, Data Analyst, Platform Super Admin |
| Evaluasi Bayesian | POST /api/v1/experiments/evaluate | Owner, Admin, CMO, Marketing Manager, Campaign Specialist, Data Analyst, Platform Super Admin |
| Monte Carlo | POST /api/v1/experiments/monte-carlo | Owner, Admin, CMO, Marketing Manager, Campaign Specialist, Data Analyst, Platform Super Admin |
| Riwayat eksperimen | GET /api/v1/experiments/results | Semua role terautentikasi |
| Operasi baca tenant | GET /api/uploads, GET /api/uploads/:id, GET /api/decisions, GET /api/v1/experiments/results | Role organisasi dan identitas AI pada tenant terkait |

## 4. Hak Akses Per Role

### Organization Owner

Hak:

- mengelola organisasi dan workspace aktif;
- menambah anggota;
- memberikan semua role organisasi, termasuk Organization Owner;
- mengunggah dataset;
- menjalankan AI Advisor;
- mengevaluasi eksperimen;
- membaca seluruh data organisasi.

Tanggung jawab yang disarankan:

- menentukan struktur organisasi;
- menetapkan Admin;
- menyetujui siapa yang dapat mengubah data dan menjalankan eksperimen;
- meninjau hasil strategis.

### Organization Admin

Hak:

- menambah anggota;
- memberikan role Admin atau role operasional;
- mengunggah dataset;
- menjalankan AI Advisor;
- mengevaluasi eksperimen;
- membaca seluruh data organisasi.

Pembatasan:

- tidak dapat menetapkan Organization Owner;
- tidak dapat memberikan role Platform Super Admin.

Tanggung jawab yang disarankan:

- menjaga kelengkapan tim;
- mengatur akun operasional;
- memastikan proses analisis tetap terstruktur.

### CMO / Executive

Hak:

- membaca dashboard, dataset, temuan, perbandingan, dan riwayat eksperimen;
- mengunggah data;
- menjalankan AI Advisor;
- menjalankan evaluasi Bayesian dan Monte Carlo.

Batasan:

- tidak mengelola anggota;
- tidak mengubah konfigurasi organisasi.

Fokus penggunaan:

- keputusan strategis;
- prioritas kampanye;
- peninjauan hipotesis;
- alokasi anggaran secara konseptual.

### Marketing Manager

Hak:

- membaca dan membandingkan data;
- mengunggah dataset;
- menjalankan AI Advisor;
- menjalankan eksperimen;
- meninjau riwayat keputusan.

Tidak dapat:

- mengelola anggota;
- menetapkan role.

Fokus penggunaan:

- perencanaan kampanye;
- pemilihan variabel eksperimen;
- koordinasi Campaign Specialist;
- tinjauan hasil dengan Financial Controller dan Data Analyst.

### Campaign Specialist

Hak:

- mengunggah CSV;
- membaca analisis dan temuan;
- menjalankan AI Advisor;
- menjalankan evaluasi eksperimen.

Tidak dapat:

- mengelola anggota;
- menetapkan role.

Fokus penggunaan:

- operasional impor data;
- pemantauan Campaign Health;
- diagnostic issue;
- persiapan eksperimen.

### Data Analyst

Hak:

- mengunggah data;
- membaca hasil analisis;
- menjalankan AI Advisor;
- menjalankan evaluasi CTR/CVR dan Monte Carlo;
- melihat riwayat eksperimen.

Tidak dapat:

- mengelola anggota.

Fokus penggunaan:

- validasi kualitas data;
- pembacaan metrik;
- analisis ketidakpastian;
- verifikasi cold-start dan expected loss;
- dokumentasi hasil.

### Financial Controller

Hak:

- membaca detail organisasi;
- membaca daftar anggota;
- membaca riwayat dataset;
- membuka detail analisis;
- membaca Campaign Health, Scenario Lab, Decision Inbox, dan riwayat eksperimen;
- membandingkan dataset.

Tidak dapat:

- mengunggah CSV;
- menjalankan AI Advisor;
- menjalankan Bayesian atau Monte Carlo;
- menambah atau mengubah anggota.

Fokus penggunaan:

- peninjauan spend, CPA, ROAS, dan conversion value;
- validasi dampak anggaran;
- pembacaan temuan risiko;
- kontrol keuangan tanpa mengubah data.

### Auditor

Hak:

- membaca organisasi aktif, anggota, riwayat upload, detail analisis, Decision Inbox, dan riwayat eksperimen;
- membaca data hanya dalam organisasi yang menjadi membership aktifnya.

Tidak dapat:

- mengunggah atau mengubah data;
- menjalankan AI Advisor, Bayesian, atau Monte Carlo;
- mengelola anggota, undangan, atau identitas service.

### AI Service Identity

Identitas ini bukan akun pengguna dan tidak memiliki password, membership role, atau akses ke pemilihan organisasi. Owner, Admin, atau Platform Super Admin membuat key yang dibatasi ke organisasi aktif. Backend menyimpan hash key, menampilkan nilai rahasia satu kali, dan mengizinkan pembacaan data tenant saja. Pemilik dapat mencabut key dari halaman organisasi.

### Platform Super Admin

Hak khusus:

- dapat memilih semua organisasi;
- dapat menambah anggota pada organisasi yang dipilih;
- dapat menetapkan semua role organisasi;
- memiliki hak tulis kampanye yang sama dengan role operasional.

Pembatasan:

- role tidak dapat dipilih saat registrasi;
- role tidak dapat diberikan melalui endpoint pengelolaan anggota;
- akun harus diprovisioning pada tabel platform_administrators oleh operator database;
- tidak dapat diberikan role Platform Super Admin kepada akun lain melalui aplikasi.
- hanya Platform Super Admin dapat mengaktifkan atau menonaktifkan akun pengguna secara global;
- akun yang dinonaktifkan ditolak saat login dan pada setiap request, sehingga token lama tidak mempertahankan akses;
- akun Platform Super Admin aktif terakhir dan akun sendiri tidak dapat dinonaktifkan dari endpoint.

## 5. Aturan Penetapan Role

| Aktor | Role yang dapat diberikan |
|---|---|
| Organization Owner | Organization Owner, Organization Admin, CMO Executive, Marketing Manager, Campaign Specialist, Data Analyst, Financial Controller, Auditor |
| Organization Admin | Organization Admin, CMO Executive, Marketing Manager, Campaign Specialist, Data Analyst, Financial Controller, Auditor |
| Platform Super Admin | Semua role organisasi, kecuali Platform Super Admin |
| CMO Executive dan role lain | Tidak dapat mengelola anggota |

Undangan dapat diterima akun baru maupun akun terdaftar. Backend menyimpan hash token acak, membatasi masa berlaku menjadi tujuh hari, dan menandai token sekali pakai setelah penerimaan. Karena layanan email belum dikonfigurasi, aplikasi menampilkan link kepada pembuat undangan satu kali untuk dikirim lewat kanal tepercaya. Undangan tidak dapat memberikan role Owner atau Platform Super Admin. Endpoint tambah anggota lama dipertahankan untuk kompatibilitas.

## 6. Pembagian Fitur Berdasarkan Fungsi

### Autentikasi dan organisasi

- registrasi membuat organisasi baru;
- pendaftar menjadi Organization Owner;
- default workspace dibuat secara otomatis;
- pemilik atau admin menambahkan akun terdaftar;
- pemilihan organisasi diperiksa ulang terhadap keanggotaan atau status Platform Super Admin;
- semua request terlindungi memvalidasi organisasi dan role aktif.

### Impor dan analisis data

Fitur:

- unggah CSV maksimal 10 MB;
- validasi kolom dan nilai;
- ringkasan impresi, klik, spend, konversi, conversion value, CTR, CPA, dan ROAS;
- temuan diagnostik beserta rekomendasi;
- kesiapan eksperimen;
- data sumber dan rekaman kampanye.

Hanya role operasional dan platform dapat menulis data. Semua role dapat membaca hasil pada organisasi aktif.

### Campaign Health

Menampilkan metrik per kampanye yang diurutkan berdasarkan pengeluaran. Mendukung drill-down ke analisis lengkap dan eksperimen.

### Scenario Lab

Menampilkan temuan yang cocok untuk skenario seperti:

- pengeluaran tanpa konversi;
- impresi tanpa klik;
- impresi atau biaya nol;
- CTR;
- tidak ada aturan khusus.

### Decision Inbox

Menampilkan temuan lintas dataset dengan pencarian, filter severity, pagination, dan tautan ke dataset asal.

### Experiment Lab

Mendukung:

- 2 sampai 20 arm untuk endpoint evaluasi;
- 6 sampai 20 arm untuk Monte Carlo;
- CTR atau CVR;
- probability to be best;
- expected loss;
- cold-start;
- budget allocation;
- riwayat hasil bersama;
- Monte Carlo dan posterior Bayesian.

Pembuatan dan penggantian hasil eksperimen dibatasi kepada role operasional dan Platform Super Admin. Semua role dapat membaca riwayat.

### AI Advisor

Menyusun:

- ringkasan;
- insight;
- hipotesis;
- rekomendasi eksperimen;
- pembatasan dan disclaimer.

AI Advisor bersifat opsional dan tidak mengubah kampanye atau anggaran secara otomatis.

## 7. Relasi Antar Role

```text
Platform Super Admin
        |
        +-- dapat mengelola dan memilih semua organisasi
        +-- mengaktifkan atau menonaktifkan akun pengguna secara global

Organization Owner
        |
        +-- Organization Admin
        |       +-- CMO Executive
        |       +-- Marketing Manager
        |       +-- Campaign Specialist
        |       +-- Data Analyst
        |       +-- Financial Controller
        |
        +-- dapat menetapkan role lain termasuk Owner lain
        +-- Auditor (baca saja)
        +-- AI Service Identity (baca saja, kredensial terpisah)
```

Relasi operasional:

- Owner menetapkan struktur dan memberikan mandat;
- Admin mengelola anggota harian;
- CMO mengarahkan prioritas strategis;
- Marketing Manager mengubah kebutuhan bisnis menjadi rencana eksperimen;
- Campaign Specialist menyiapkan dan mengunggah data kampanye;
- Data Analyst memvalidasi data dan membaca hasil statistik;
- Financial Controller meninjau dampak biaya dan pengembalian;
- Platform Super Admin melakukan supervisi lintas organisasi.

## 8. Skenario Antar Role

### Skenario 1: Penambahan tim baru

1. Organization Owner atau Admin membuka halaman Organization.
2. Owner/Admin memasukkan email dan memilih role, lalu membuat undangan.
3. Sistem menampilkan link sekali pakai. Pembuat mengirimkannya melalui kanal tepercaya.
4. Penerima membuka link, lalu memasukkan nama dan password baru atau password akun yang sudah terdaftar.
5. Backend memeriksa email tujuan, masa berlaku, status penggunaan, dan keunikan membership sebelum menerima undangan.
6. Akun muncul pada daftar anggota dan langsung masuk ke organisasi.

Aturan:

- Admin tidak dapat memberi role Owner;
- Owner dapat memberi role Owner;
- undangan tidak dapat memberi role Owner atau Platform Super Admin;
- token hanya dapat dipakai sekali dan kedaluwarsa setelah tujuh hari.

### Skenario 2: Unggah data kampanye

1. Campaign Specialist atau role operasional membuka Import Data.
2. File CSV dipilih dan divalidasi.
3. Backend menghitung metrik, temuan, dan kesiapan eksperimen.
4. Data tersimpan pada organisasi aktif.
5. Financial Controller dan role lain dapat membaca hasil.

Financial Controller tidak dapat memulai proses unggah.

### Skenario 3: Diagnosis performa

1. Data Analyst atau Campaign Specialist mengunggah dataset.
2. Marketing Manager membuka Campaign Health atau Scenario Lab.
3. CMO meninjau temuan yang paling parah pada Decision Inbox.
4. Financial Controller meninjau spend, CPA, dan ROAS.
5. Owner atau Admin menentukan tindak lanjut organisasi.

### Skenario 4: Perancangan eksperimen

1. Marketing Manager memilih dataset.
2. Data Analyst memastikan kualitas dan kecukupan data.
3. Campaign Specialist menyiapkan variabel dan arm.
4. CMO meninjau hipotesis.
5. Role operasional yang diizinkan menjalankan eksperimen.
6. Hasil tersimpan dan dapat dibaca oleh seluruh anggota organisasi.

Jika setiap arm belum mencapai minimal 100 impresi, sistem menandai cold-start dan menahan winner serta allocation.

### Skenario 5: Peninjauan anggaran

1. Financial Controller membuka dashboard dan detail dataset.
2. Controller meninjau spend, CPA, ROAS, dan conversion value.
3. Controller membaca temuan serta rekomendasi.
4. Marketing Manager meninjau hasil dan menyiapkan eksperimen.
5. CMO atau Owner memutuskan prioritas anggaran.

Financial Controller dapat memberi masukan tetapi tidak mengubah dataset atau menjalankan AI atau eksperimen.

### Skenario 6: Review AI Advisor

1. Marketing Manager atau CMO meminta AI Advisor pada dataset.
2. Sistem menghasilkan ringkasan, insight, hipotesis, dan eksperimen yang disarankan.
3. Data Analyst memeriksa pembatasan dan kualitas data.
4. Campaign Specialist menyiapkan verifikasi lapangan.
5. Owner atau CMO memutuskan tindakan.

Semua rekomendasi tetap sebagai bahan tinjauan. Tidak ada perubahan kampanye atau anggaran otomatis.

### Skenario 7: Pemeriksaan lintas organisasi

1. Platform Super Admin login.
2. Super Admin memilih organisasi tertentu.
3. Sesi berpindah ke konteks organisasi terpilih.
4. Super Admin dapat membaca dan menulis sesuai hak operasional platform.
5. Super Admin membuat undangan atau mengelola membership pada organisasi yang dipilih.
6. Untuk menonaktifkan akun, Super Admin memakai kontrol platform. Penonaktifan berlaku pada semua organisasi dan memblokir sesi aktif berikutnya.

Perubahan organisasi juga dipakai untuk mengisolasi upload dan riwayat.

### Skenario 8: Pemulihan keanggotaan

1. Akun kehilangan akses organisasi.
2. Owner atau Admin menambahkan kembali akun dari halaman Organization.
3. Akun mendapat organisasi aktif dan role baru.
4. Sesi lama diperiksa ulang pada request berikutnya.

Migrasi atau perubahan keanggotaan dapat mengharuskan pengguna login ulang agar token memperbarui organisasi dan role aktif.

## 9. Isi Organisasi dan Isolasi Data

Setiap upload, finding, dan hasil eksperimen memiliki scope organisasi. Pada model saat ini:

- data hanya dibaca dalam organisasi aktif;
- hasil eksperimen dibaca bersama oleh anggota organisasi;
- user lama dan statistik lama dimigrasikan melalui proses database;
- organisasi, workspace, dan role disimpan terpisah;
- role Platform Super Admin hanya memiliki status khusus pada tabel platform_administrators.

## 10. Ringkasan Kebijakan Akses

- Read-only utama: Financial Controller.
- Pengelola anggota: Owner, Admin, dan Platform Super Admin.
- Role tulis kampanye: Platform Super Admin, Owner, Admin, CMO, Marketing Manager, Campaign Specialist, dan Data Analyst.
- Role eksekutif dan operasional dapat membaca serta menganalisis data.
- AI dan eksperimen dilarang untuk Financial Controller.
- Auditor hanya dapat membaca data tenant aktif.
- AI Service Identity memakai key terpisah, memiliki scope satu tenant, dan hanya dapat membaca.
- Penonaktifan akun bersifat global dan hanya tersedia untuk Platform Super Admin.
- Platform Super Admin tidak dapat ditetapkan melalui UI atau endpoint registrasi.
- Aplikasi tidak melakukan perubahan kampanye atau rollback otomatis.
