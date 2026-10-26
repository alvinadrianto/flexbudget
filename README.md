# FlexBudget — Personal Finance & Flexible Budgeting PWA

**FlexBudget** adalah aplikasi kontrol finansial pribadi dan sistem anggaran fleksibel berbasis Progressive Web App (PWA) yang dapat diinstal langsung di smartphone (Android & iOS) maupun desktop, dengan penyimpanan cloud aman menggunakan **Supabase PostgreSQL (Row Level Security)** dan deployment gratis di **Cloudflare Pages**.

---

## 🌟 Fitur Utama (Flexible Budgeting)

1. **Konsep Akuntansi Terlacak (Double-Entry Alokasi Tanpa Kehilangan Saldo)**
   - `Saldo Terlacak = Saldo Awal + Total Pemasukan - Total Pengeluaran`.
   - Mutasi antar-amplop atau alokasi ke tabungan **tidak pernah mengubah Saldo Terlacak**.
   - Setiap rupiah terlacak secara presisi menggunakan integer Rupiah murni (bebas *floating-point errors*).
   - Invarian akuntansi selalu valid: `Saldo Terlacak === Total Amplop + Saldo Bebas (Unallocated)`.

2. **Diferensiasi: Penutupan Defisit Otomatis & Manual**
   - Saat suatu amplop pengeluaran defisit (*overspent*), sistem mendeteksi kekurangan nominal secara akurat.
   - **Manual**: Pilih amplop sumber yang memiliki surplus, tentukan nominal, dan lihat proyeksi saldo sebelum konfirmasi.
   - **Otomatis**: Sistem menarik surplus berdasarkan aturan prioritas tanpa mengurangi saldo tabungan/dana darurat yang diproteksi (*min_protected_balance*).

3. **Tunjangan Rutin Harian & Mingguan dari Pool Pendanaan**
   - Contoh: Daily Spending Pool (Rp900.000) melepas Rp30.000/hari ke amplop Pengeluaran Harian.
   - Jajan Pool (Rp800.000) melepas Rp200.000/minggu.
   - Bersifat **idempotent**: rilis alokasi tidak akan terduplikasi jika halaman di-*refresh*.
   - Tidak menciptakan uang baru: jika dana di pool tidak cukup, sistem melaporkan kekurangan secara transparan.

4. **Pengalihan Surplus (Surplus Reserving)**
   - Di akhir periode atau saat tinjauan, sisa saldo yang tidak terpakai dapat dialihkan ke Tabungan Utama atau Dana Darurat dengan satu klik.

5. **PWA Installable & Offline Resilience**
   - Mendukung instalasi aplikasi di homescreen ponsel melalui browser.
   - Caching aman hanya untuk *application-shell* dan *static assets* (tidak mencache kredensial atau data keuangan pribadi di public cache).
   - Indikator status koneksi (*Online/Offline/Cloud RLS/Lokal*).

6. **Ekspor & Pemulihan Data Independen**
   - Ekspor CSV transaksi dan mutasi transfer.
   - Full JSON Backup & Restore dengan validasi skema versi 1.0.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript (Strict Mode), Vite, Tailwind CSS, Lucide Icons, Vite PWA Plugin (`vite-plugin-pwa`).
- **Backend & Database**: Supabase Authentication, Supabase PostgreSQL, Supabase Row Level Security (RLS).
- **Pengujian**: Vitest (18 Unit Tests lengkap mencakup 16 invarian akuntansi).
- **Hosting**: Cloudflare Pages (Free Tier).

---

## 🚀 Panduan Menjalankan Secara Lokal

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Menjalankan Tes Otomatis (Vitest)
```bash
npm test
```

### 3. Menjalankan Server Pengembangan Lokal
```bash
npm run dev
```
Akses di browser: `http://localhost:5173/`

### 4. Build Produksi
```bash
npm run build
npm run preview
```

---

## 🔒 Konfigurasi Supabase (PostgreSQL & RLS)

FlexBudget dapat langsung dicoba secara lokal tanpa konfigurasi awal. Namun untuk mengaktifkan sinkronisasi cloud pribadi:

### Langkah 1: Buat Proyek Supabase
1. Buka [Supabase Dashboard](https://supabase.com/dashboard) dan buat proyek baru (*Free tier*).
2. Pilih wilayah terdekat (misal: `Singapore`).

### Langkah 2: Jalankan Migrasi Database
Buka menu **SQL Editor** di Supabase Dashboard, lalu salin dan jalankan seluruh isi file:
```
supabase/migrations/20261026000000_flexbudget_schema.sql
```
Skema ini secara otomatis:
- Membuat tabel `profiles`, `envelopes`, `transactions`, `transfers`, `deficit_rules`, dan `period_reviews`.
- Mengaktifkan **Row Level Security (RLS)** pada setiap tabel.
- Menerapkan *policy* ketat: `auth.uid() = user_id` untuk operasi `SELECT`, `INSERT`, `UPDATE`, dan `DELETE`.
- Mengatur *trigger* otomatis untuk profil pemilik saat pertama kali mendaftar.

### Langkah 3: Konfigurasi File Environment
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi dengan kredensial API dari **Supabase Dashboard -> Project Settings -> API**:
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### Langkah 4: Registrasi Akun Pemilik & Kunci Pendaftaran
1. Jalankan aplikasi dan buka modal **Daftar Pemilik**.
2. Daftarkan email dan password Anda.
3. Setelah akun pemilik berhasil dibuat, **buka Supabase Dashboard -> Authentication -> Providers -> Email**, lalu matikan opsi **Enable Signups**.
4. Ini memastikan tidak ada orang asing yang bisa mendaftar ke database Supabase Anda.

---

## 🌐 Panduan Deployment ke Cloudflare Pages

1. Masuk ke [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
2. Pilih repositori GitHub `FlexBudget`.
3. Masukkan konfigurasi build:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Di bagian **Environment variables**, tambahkan:
   - `VITE_SUPABASE_URL`: *(URL Supabase Anda)*
   - `VITE_SUPABASE_ANON_KEY`: *(Anon key publik Supabase Anda)*
5. Klik **Save and Deploy**.
6. Cloudflare Pages akan mempublikasikan aplikasi dengan domain HTTPS gratis (contoh: `https://flexbudget.pages.dev`).

---

## 📱 Panduan Instalasi PWA di Smartphone

### Di Android (Chrome / Brave / Edge):
1. Buka URL HTTPS FlexBudget di browser Chrome.
2. Ketuk ikon menu titik tiga di kanan atas atau tombol notifikasi "Tambahkan ke Layar Utama" (*Add to Home screen*).
3. Pilih **Instal FlexBudget**. Aplikasi akan terpasang di laci aplikasi seperti aplikasi native.

### Di iPhone / iPad (Safari):
1. Buka URL HTTPS FlexBudget di browser Safari.
2. Ketuk tombol **Share** (ikon kotak dengan panah ke atas) di bagian bawah.
3. Gulir ke bawah dan pilih **Add to Home Screen** (*Tambahkan ke Layar Utama*).
4. Beri nama **FlexBudget** dan ketuk **Add**.

---

## 🧪 Verifikasi Pengujian Akuntansi

Pengujian unit otomatis terverifikasi pada file `src/services/financialEngine.test.ts`:
- ✅ Pemasukan Rp3.800.000 menaikkan saldo terlacak sebesar Rp3.800.000.
- ✅ Alokasi template mendistribusikan tepat Rp3.800.000 tanpa sisa saldo unallocated.
- ✅ Pelepasan tunjangan Rp30.000 dari pool tidak mengubah saldo terlacak.
- ✅ Pengeluaran Rp10.000 mengurangi saldo amplop dan saldo terlacak tepat Rp10.000.
- ✅ Transfer surplus Rp20.000 ke dana darurat tidak menambah pemasukan atau saldo terlacak.
- ✅ Rilis harian berikutnya ditarik dari sisa pool pendanaan.
- ✅ Pengeluaran Rp250.000 pada amplop bersaldo Rp200.000 menghasilkan defisit tepat Rp50.000.
- ✅ Penutupan defisit Rp50.000 dari sumber yang sah menuntaskan defisit secara seimbang.
- ✅ Penutupan otomatis melindungi tabungan minimum (*min_protected_balance*).
- ✅ Pool yang tidak mencukupi tidak mengizinkan pembuatan uang semu.
- ✅ Operasi rilis periode bersifat *idempotent* (tidak terduplikasi).
- ✅ Edit/Hapus transaksi mempertahankan semua invarian akuntansi.
- ✅ Validasi integritas ekspor CSV dan Full Backup JSON.

---

## 📄 Lisensi
MIT License — Dibuat untuk kendali finansial pribadi yang aman, fleksibel, dan mandiri.
