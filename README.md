# Advisora

Advisora adalah workspace untuk meninjau performa kampanye dari CSV dan
mengevaluasi eksperimen iklan. Sistem menyimpan dataset per akun, menghitung
metrik dan temuan melalui backend, serta menyediakan alur analisis dan
perbandingan yang dapat ditelusuri.

## Fitur yang tersedia

- Registrasi dan login berbasis email.
- Dashboard workspace dan riwayat dataset per organisasi.
- Impor CSV, ringkasan metrik, dan temuan diagnostik.
- Detail analisis dengan AI Advisor opsional untuk insight dan usulan eksperimen.
- Kesehatan kampanye dan penjelasan kesiapan eksperimen.
- Inbox temuan dengan pencarian, filter tingkat, dan pagination.
- Evaluasi varian menggunakan posterior Bayesian CTR atau CVR.
- Riwayat evaluasi Bayesian yang dapat dibaca bersama oleh anggota organisasi.
- Perbandingan metrik deskriptif antara dua dataset.
- Organisasi, workspace awal, dan keanggotaan dengan role terpisah.
- Pengelolaan anggota organisasi untuk akun Advisora yang sudah terdaftar.
- Isolasi upload dan analisis berdasarkan organisasi aktif.

## Alur pengguna

1. **Buat akun atau masuk.** Pendaftaran meminta nama organisasi dan membuat
   pendaftar sebagai Organization Owner. Owner/Admin menambahkan pengguna yang
   sudah mendaftar; tidak ada undangan email.
2. **Unggah CSV kampanye.** File maksimal 10 MB harus memakai pemisah koma,
   berisi kolom `date`, `campaign`, `impressions`, `clicks`, `spend`,
   `conversions`, dan `conversion_value`. Tanggal memakai format `YYYY-MM-DD`;
   angka tidak boleh negatif dan klik tidak boleh melebihi impresi. Jika seluruh
   file lolos validasi, backend menyimpannya lalu menghitung metrik, temuan, dan
   kesiapan eksperimen. File yang tidak valid ditolak, bukan disimpan sebagian.
3. **Tinjau detail analisis.** Periksa impresi, klik, biaya, konversi, CTR, CPA,
   ROAS, temuan diagnostik, kesiapan eksperimen, dan data sumber. AI Advisor
   dapat dijalankan secara opsional untuk meminta ringkasan, insight, hipotesis,
   dan usulan eksperimen.
4. **Pilih alur lanjutan sesuai kebutuhan:**
   - **Kesehatan kampanye:** pilih dataset, lalu tinjau metrik per kampanye
     yang diurutkan menurut pengeluaran. Buka analisis lengkap atau lanjut ke
     evaluasi varian.
   - **Skenario diagnostik:** pilih dataset dan kondisi yang ingin diperiksa.
     Advisora menampilkan temuan yang cocok serta langkah pemeriksaan, misalnya
     pengeluaran tanpa konversi, impresi tanpa klik, impresi atau biaya nol,
     CTR yang tersedia, atau tidak ada aturan khusus yang terpicu.
   - **Inbox keputusan:** cari dan filter temuan berdasarkan tingkat
     keparahan, lalu buka analisis dataset untuk melihat konteksnya.
   - **Experiment Lab:** pilih dataset, tentukan 2 sampai 20 kampanye sebagai
     arm, pilih CTR atau CVR, lalu jalankan evaluasi Bayesian. Hasilnya
     mencakup probabilitas menjadi arm terbaik, expected loss, status
     kecukupan data, dan alokasi simulasi. AI Advisor juga dapat diminta untuk
     menyusun hipotesis yang ditinjau pengguna. Jika setiap arm belum memiliki
     minimal 100 impresi, hasil ditandai cold-start dan pemenang serta alokasi
     tidak ditetapkan.
   - **Bandingkan dataset:** pilih dua upload untuk membandingkan metrik dan
     selisihnya secara deskriptif.
   - **Riwayat analisis:** cari dataset yang pernah diunggah, telusuri halaman
     riwayat, dan buka kembali analisisnya.

## Keunggulan untuk pengguna

- **Satu dataset untuk beberapa alur kerja.** Upload yang sama dapat ditinjau
  sebagai ringkasan kampanye, temuan, skenario diagnostik, atau bahan evaluasi
  eksperimen.
- **Temuan dapat ditelusuri ke sumbernya.** Inbox menampilkan nama file dan
  mengarahkan pengguna ke analisis dataset terkait.
- **Ada langkah pemeriksaan, bukan hanya angka.** Temuan diagnostik menyertakan
  konteks dan hal yang perlu diverifikasi sebelum pengguna mengambil tindakan.
- **Evaluasi eksperimen menampilkan ketidakpastian.** Pengguna dapat meninjau
  probabilitas terbaik, expected loss, serta status cold-start, bukan hanya
  satu nilai pemenang.
- **Pengguna tetap memegang keputusan.** Rekomendasi dan alokasi eksperimen
  adalah bahan tinjauan. Aplikasi tidak mengubah kampanye atau anggaran.

## Menjalankan secara lokal

### Backend

Prasyarat: Go sesuai versi pada `backend/go.mod` dan PostgreSQL.

1. Salin `backend/.env.example` menjadi `backend/.env`, lalu isi
   `DATABASE_URL` dan `AUTH_SECRET` dengan nilai lokal Anda.
2. Jalankan migrasi SQL `001` sampai `007` secara berurutan pada database.
   Migrasi `005` membuat organisasi/workspace default dan memetakan upload lama
   yang memiliki pemilik ke organisasi pemiliknya. Upload lama tanpa pemilik
   yang dapat diverifikasi tetap tidak terhubung. Migrasi `006` memindahkan
   statistik eksperimen ke scope organisasi/workspace sambil mempertahankan
   tabel statistik pengguna lama. Migrasi `007` menyimpan ringkasan hasil
   evaluasi untuk dibaca bersama dalam organisasi. Setelah migrasi, masuk
   kembali agar sesi memuat organisasi aktif.
3. Dari folder `backend`, jalankan:

   ```powershell
   go run .
   ```

API berjalan pada port `8080` secara default. Lihat
[`backend/README.md`](./backend/README.md) untuk konfigurasi database, API,
dan detail model eksperimen.

### Frontend

Prasyarat: Node.js sesuai versi yang didukung Next.js dan npm.

1. Dari folder `frontend`, pasang dependency dan jalankan aplikasi:

   ```powershell
   npm ci
   npm run dev
   ```

2. Buka `http://localhost:3000`. Frontend memakai
   `http://localhost:8080` sebagai API secara default. Untuk alamat lain, set
   `NEXT_PUBLIC_API_URL` sebelum menjalankan Next.js.
3. Buat akun melalui halaman masuk, lalu unggah dataset CSV.

## Verifikasi

```powershell
# backend
Set-Location backend
go test ./...
go vet ./...

# frontend
Set-Location ..\frontend
npm run lint
npx tsc --noEmit
npm run build
```

## Batasan saat ini

Data kampanye berasal dari CSV yang diunggah pengguna. Evaluasi Bayesian
menghitung posterior dan ringkasan untuk data masukan, tetapi data historis
tidak membuktikan bahwa kampanye dijalankan secara acak atau bahwa perubahan
menyebabkan hasil tertentu.

Konektor Meta, Google Ads, dan TikTok; perubahan kampanye otomatis; rollback
tindakan; verifikasi organisasi NGO; atribusi penerima manfaat; serta billing
gain-sharing belum tersedia. Jangan gunakan proyeksi atau target di dokumen
produk sebagai hasil yang telah dicapai.

Fondasi organisasi pada fase ini mencakup tujuh role organisasi. Platform Super
Admin adalah akun yang diprovisikan terpisah melalui akses operasional database;
role ini tidak dapat dipilih saat registrasi atau diberikan oleh Owner/Admin.
Pengelolaan Business Unit dan Brand, undangan email, konfigurasi platform
terpusat, serta integrasi iklan masih belum tersedia.
