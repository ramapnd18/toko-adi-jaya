# Toko Adi Jaya

Project Manajemen Inventori dan Kasir untuk Toko Adi Jaya. Proyek ini dibangun menggunakan **Node.js, Express, TailwindCSS,** dan **Prisma ORM** yang dihubungkan ke **Supabase (PostgreSQL)**.

---

## Panduan Instalasi Lokal (Langkah demi Langkah)

### 1. Kloning Repositori
Atau unduh dan ekstrak folder project ini, lalu buka terminal di dalam folder tersebut:
```bash
cd toko-adi-jaya
```

### 2. Install Dependensi (Library)
```bash
npm install
```

### 3. Konfigurasi Variabel Lingkungan (.env)
Buat file `.env` di *root* direktori, lalu isi dengan kredensial Supabase Anda:
```env
# Koneksi via pgbouncer (Transaction mode) — port 6543
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Koneksi langsung (Session mode) — port 5432, untuk migrate
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-[REGION].pooler.supabase.com:5432/postgres"
```
*(URL bisa didapat dari **Project Settings → Database** di dashboard Supabase).*

### 4. Setup Database Prisma
```bash
npx prisma generate
npx prisma db push
```

### 5. Compile CSS Tailwind (terminal terpisah)
```bash
npm run build:css
```

### 6. Jalankan Server
```bash
npm start
```
Server berjalan di **http://localhost:3000**

---

## 🚀 Panduan Deploy ke Vercel

### Prasyarat
- Akun [Vercel](https://vercel.com) (bisa daftar gratis)
- Akun [GitHub](https://github.com) (untuk menghubungkan repositori)
- Database Supabase sudah aktif dan skema sudah di-push (`npx prisma db push`)

---

### Langkah 1 — Push Kode ke GitHub

Buat repositori baru di GitHub (kosong, tanpa README), lalu jalankan di terminal:
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/[USERNAME]/[NAMA-REPO].git
git push -u origin main
```
> **Penting:** File `.env` sudah ada di `.gitignore`, jadi **kredensial database Anda aman** dan tidak akan ikut ter-upload ke GitHub.

---

### Langkah 2 — Import Project di Vercel

1. Buka [vercel.com](https://vercel.com) → klik **"Add New Project"**
2. Pilih **"Import Git Repository"** → pilih repositori `toko-adi-jaya` yang baru saja Anda push
3. Pada bagian **"Framework Preset"**, pilih **Other**
4. Biarkan semua pengaturan build default, lalu **jangan klik Deploy dulu** — lanjut ke langkah berikutnya

---

### Langkah 3 — Tambahkan Environment Variables di Vercel

Sebelum deploy, Anda **wajib** menambahkan variabel lingkungan agar server bisa terhubung ke database Supabase.

Di halaman konfigurasi project Vercel, scroll ke bawah ke bagian **"Environment Variables"**:

| Name | Value |
|------|-------|
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@...:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | `postgresql://postgres.[REF]:[PASS]@...:5432/postgres` |

*(Salin nilai persis dari file `.env` lokal Anda)*

Klik **Add** untuk setiap variabel, lalu klik **Deploy**.

---

### Langkah 4 — Tunggu Build & Akses URL

Vercel akan otomatis membangun dan men-deploy aplikasi Anda. Setelah selesai (~1-2 menit), Anda akan mendapatkan URL publik seperti:

```
https://toko-adi-jaya.vercel.app
```

---

### Langkah 5 — Jalankan Seeder (Jika Database Kosong)

Jika ini pertama kali deploy dan tabel `pengguna` masih kosong, jalankan seeder dari komputer lokal Anda:
```bash
node prisma/seed.js
```
Ini akan menambahkan akun admin default:
- **Username:** `admin`
- **Password:** `password123`

---

### ⚠️ Catatan Penting untuk Vercel

> **Upload Foto Tidak Tersimpan Permanen di Vercel!**
> Vercel berjalan secara *serverless* dan tidak memiliki filesystem yang persisten. Setiap kali server di-restart, file yang diupload ke `public/uploads/` akan **hilang**. Untuk solusi permanen, gunakan layanan penyimpanan cloud seperti **Supabase Storage** atau **Cloudinary**.

> **Auto-Deploy:** Setiap kali Anda `git push` ke branch `main`, Vercel akan otomatis men-deploy versi terbaru aplikasi Anda.

---

## Catatan
- Foto yang diupload disimpan sementara di `public/uploads/` (lokal) dan di-ignore oleh Git.
- Untuk production, disarankan menggunakan penyimpanan cloud untuk file/foto.
