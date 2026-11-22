# Advisora UI Direction

## Design read

Membaca desain ini sebagai dashboard operasi pemasaran enterprise untuk tim marketing, data, dan finance, dengan nuansa gelap dan energi tinggi dari referensi pengguna, dial ENERGY 3 / RHYTHM 2 / MOTION 1.

## Identity

Advisora membantu tim meninjau performa kampanye dan membuat keputusan dari data yang dapat ditelusuri. Antarmuka perlu terasa tegas dan fokus pada bukti, bukan seperti chatbot umum.

## Palette and theme

- Deep navy menjadi permukaan utama, mengikuti referensi dashboard gelap.
- Cyan atau biru dipakai untuk aksi utama dan status aktif agar mudah dikenali.
- Violet menjadi aksen sekunder yang menghubungkan produk dengan referensi visual.
- Gradien dipakai hanya pada satu fokus visual, bukan sebagai latar seluruh aplikasi.
- Glow dibatasi maksimal pada satu atau dua elemen.
- Tema gelap menjadi pilihan awal; pengguna dapat beralih ke tema terang.
- Status risiko, sukses, dan error tetap memiliki label teks, bukan warna saja.

## Layout

- Susun setiap halaman mengikuti keputusan yang perlu dibuat pengguna.
- Dashboard dimulai dari data dan alur kerja yang benar-benar tersedia, bukan kolase panel pada gambar referensi.
- Bedakan bagian penting dan pendukung melalui ukuran, urutan, dan ruang.
- Setiap halaman harus memiliki keadaan loading, empty, dan error yang menjelaskan tindakan berikutnya.
- Navigasi hanya memuat halaman yang tersedia.
- Layout harus reflow untuk ponsel dan tablet, bukan sekadar mengecilkan desktop.

## Typography

- Gunakan Geist Sans untuk membaca label, metrik, dan tabel dengan rapat tanpa mengorbankan keterbacaan.
- Gunakan monospace hanya untuk identifier atau nilai teknis jika tampilannya memberi manfaat nyata.
- Hindari label kapital dengan tracking lebar sebagai dekorasi.

## Data and content

- Gunakan hanya nilai dari dataset atau API yang benar-benar tersedia.
- Jangan menyalin angka, persentase perubahan, nama kampanye, logo provider, atau statistik dari gambar konsep sebagai data produk.
- Jangan tampilkan fitur yang belum diimplementasikan sebagai kontrol aktif.
- AI Advisor yang tersedia tetap menjadi saran untuk ditinjau. Jangan tampilkan chatbot atau AI Command Center sebelum fungsinya dibangun.
- Jangan tampilkan integrasi Meta, Google, TikTok, atau LinkedIn sebagai tersambung tanpa status koneksi nyata.

## Motion and interaction

- MOTION 1: gunakan hover, focus, dan transisi singkat untuk umpan balik, tanpa animasi dekoratif berulang.
- Setiap kontrol harus memiliki perilaku nyata dan bisa dioperasikan dengan keyboard serta sentuhan.
- Hormati preferensi reduced motion.

## Mark and icon use

- Pertahankan nama Advisora sebagai wordmark teks.
- Jangan membuat logo atau ilustrasi baru dari asumsi.
- Pakai ikon hanya jika bentuknya membantu mengenali aksi atau jenis data tertentu.

## Decision rationale

- Navy memberi latar yang kontras untuk data; cyan menjadi penanda aksi; violet menjadi aksen dari referensi pengguna.
- Gradien dibatasi ke satu fokus untuk mempertahankan nuansa gambar tanpa membuat semua permukaan bersaing.
- Komposisi mengikuti alur kerja karena screenshot hanya referensi visual dan angka serta fitur di dalamnya bukan data Advisora.
- Geist Sans dipertahankan karena proyek sudah memuatnya dan dashboard perlu membaca angka pada ruang terbatas.
- Tema gelap dipilih sebagai awal dari referensi; tema terang tersedia untuk kondisi kerja dan preferensi pengguna yang berbeda.
