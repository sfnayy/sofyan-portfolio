# Portfolio — Sofyan Adiel Muliansyah

Website portfolio pribadi untuk mahasiswa Teknik Informatika, Universitas Pelita Bangsa.
Dibangun dengan HTML, CSS, dan JavaScript murni (tanpa build step), tema gelap modern,
dan dilengkapi **panel admin** untuk memperbarui konten kapan saja.

## Fitur

- **Hero** dengan efek mengetik, status ketersediaan, foto dengan cincin gradasi, dan tautan sosial.
- **Tentang saya** bergaya bento grid: bio, pendidikan, jam lokal (WIB), statistik otomatis, fokus keahlian, hal yang sedang dipelajari, dan minat.
- **Skill** dengan filter kategori, ikon teknologi otomatis (Devicon), dan bar tingkat penguasaan.
- **Proyek** dengan filter, pencarian, kartu "Unggulan", sampul otomatis, dan detail proyek dalam modal (bisa dibagikan lewat link `#proyek/<id>`).
- **Sertifikat** dengan filter kategori, lightbox gambar, dukungan PDF, dan link verifikasi.
- **Pendidikan & pengalaman** dalam bentuk timeline.
- **Aktivitas GitHub** langsung dari API: statistik, bahasa terbanyak, grafik kontribusi, dan repositori terbaru.
- **Kontak**: salin email, WhatsApp, dan formulir (mailto / WhatsApp / Formspree).
- **Pencarian cepat** `Ctrl + K` (atau `/`) untuk lompat ke bagian, proyek, atau sertifikat.
- Navigasi mulus dengan indikator bagian aktif, progress bar scroll, animasi muncul saat scroll, responsif sampai layar ponsel, dan menghormati pengaturan *reduce motion*.

## Cara memperbarui konten (panel admin)

Buka **`/admin`** di situs kamu (contoh: `https://nama-situs.vercel.app/admin`).

1. **Hubungkan GitHub** (sekali per perangkat): menu *Koneksi GitHub* → ikuti langkah membuat
   *fine-grained personal access token* dengan izin **Contents: Read and write** khusus repositori ini.
2. **Edit** profil, skill, proyek, sertifikat, pengalaman, dll. Gambar dan PDF bisa diunggah langsung
   (gambar dikompres otomatis). Semua perubahan tersimpan otomatis sebagai draft di browser.
3. Klik **Pratinjau** untuk melihat hasilnya sebelum tayang.
4. Klik **Publikasikan**. Perubahan di-commit ke GitHub, lalu Vercel membangun ulang situs dalam ±1 menit.

> Token hanya disimpan di browser perangkat yang kamu pakai. Jangan menyimpannya di komputer umum.

Alternatif tanpa admin: edit langsung file [`data/portfolio.json`](data/portfolio.json) lalu commit & push.

## Struktur

```
├── index.html            # Halaman utama
├── admin/                # Panel admin (CMS berbasis GitHub)
├── assets/
│   ├── css/style.css
│   ├── js/shared.js      # Utilitas bersama (ikon, penyimpanan, format)
│   ├── js/main.js        # Render & interaksi halaman utama
│   ├── img/              # Foto profil
│   └── uploads/          # File yang diunggah dari admin
├── data/portfolio.json   # Seluruh konten situs
├── vercel.json           # Konfigurasi Vercel (clean URL, header cache)
└── 404.html
```

## Menjalankan secara lokal

Karena konten dimuat lewat `fetch`, buka lewat server lokal (bukan klik dua kali file HTML):

```bash
npx serve .
# lalu buka http://localhost:3000
```

## Deploy

Repositori ini terhubung ke Vercel: setiap push ke branch `main` (termasuk dari panel admin) otomatis
memperbarui situs. Tidak ada build command; output directory adalah root proyek.
