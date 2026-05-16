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

> **Auto-Deploy:** Setiap kali Anda `git push` ke branch `main`, Vercel akan otomatis men-deploy versi terbaru aplikasi Anda.

---

## 🗂️ Setup Supabase Storage (Untuk Upload Foto)

Aplikasi ini menggunakan **Supabase Storage** agar foto pengguna tersimpan secara permanen di cloud (tidak hilang saat Vercel restart).

### Langkah A — Buat Bucket di Supabase

1. Buka [supabase.com](https://supabase.com) → masuk ke project Anda
2. Di sidebar kiri, klik **Storage**
3. Klik **"New Bucket"**
4. Isi nama bucket: `foto-pengguna`
5. Centang **"Public bucket"** agar foto bisa diakses publik via URL
6. Klik **Save**

### Langkah B — Dapatkan Kredensial API Supabase

1. Buka **Project Settings → API**
2. Salin nilai berikut:
   - **Project URL** → untuk `SUPABASE_URL`
   - **service_role** (Secret) → untuk `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ **Jangan bagikan `SUPABASE_SERVICE_ROLE_KEY` ke publik!** Key ini memberikan akses penuh ke project Supabase Anda.

### Langkah C — Isi `.env` Lokal

Tambahkan dua baris ini ke file `.env` Anda:
```env
SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="[YOUR-SERVICE-ROLE-KEY]"
```

### Langkah D — Tambahkan ke Environment Variables Vercel

Di dashboard Vercel → **Settings → Environment Variables**, tambahkan semua variabel berikut:

| Name | Keterangan |
|------|------------|
| `DATABASE_URL` | URL pgbouncer Supabase (port 6543) |
| `DIRECT_URL` | URL direct Supabase (port 5432) |
| `SUPABASE_URL` | Project URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (Secret) dari Supabase |

---

## Catatan
- Foto pengguna yang diupload kini tersimpan permanen di **Supabase Storage** (bucket `foto-pengguna`).
- Folder `public/uploads/` tidak lagi digunakan untuk production.

