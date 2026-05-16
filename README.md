# Toko Adi Jaya

Project Manajemen Inventori dan Kasir untuk Toko Adi Jaya. Proyek ini dibangun menggunakan **Node.js, Express, TailwindCSS,** dan **Prisma ORM** yang dihubungkan ke **Supabase (PostgreSQL)**.

## Persyaratan Sistem
Pastikan Anda sudah menginstal perangkat lunak berikut di komputer Anda:
- **Node.js** (versi 16 atau lebih baru)
- **Git** (opsional, untuk version control)

## Panduan Instalasi (Langkah demi Langkah)

### 1. Kloning Repositori (Jika menggunakan Git)
Atau Anda bisa mengunduh dan mengekstrak folder project ini ke komputer Anda. Buka terminal/Command Prompt, lalu arahkan ke dalam folder proyek:
```bash
cd toko-adi-jaya
```

### 2. Install Dependensi (Library)
Instal semua pustaka Node.js yang dibutuhkan oleh aplikasi ini, termasuk Express, Prisma, Tailwind, dan lain-lain:
```bash
npm install
```

### 3. Konfigurasi Variabel Lingkungan (.env)
Aplikasi ini memerlukan kredensial database untuk berjalan. 
1. Buat file baru bernama `.env` di *root* direktori (satu tempat dengan `package.json`).
2. Isi file `.env` tersebut dengan kredensial Supabase Anda. Gunakan format berikut:

```env
# Koneksi Prisma ke Supabase
# DATABASE_URL biasanya menggunakan port 6543 (Transaction mode / pgbouncer)
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# DIRECT_URL menggunakan port 5432 (Session mode) digunakan untuk sinkronisasi skema
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-[REGION].pooler.supabase.com:5432/postgres"
```
*(Catatan: Anda bisa mendapatkan URL ini dari menu **Project Settings -> Database** di dashboard Supabase).*

### 4. Setup dan Sinkronisasi Database Prisma
Setelah URL di `.env` sudah sesuai, sinkronkan skema Prisma dengan database Supabase Anda:
```bash
npx prisma generate
npx prisma db push
```
- `prisma generate` akan membuat ulang client Prisma (`@prisma/client`) yang akan dipakai oleh Express.
- `prisma db push` akan membuat tabel-tabel di Supabase secara otomatis sesuai dengan `prisma/schema.prisma`.

### 5. Compile CSS Tailwind
Aplikasi ini menggunakan TailwindCSS. Jika Anda mengubah desain di file `src/input.css` atau class di HTML, Anda harus men-compile CSS tersebut.
Jalankan perintah ini di **terminal terpisah**:
```bash
npm run build:css
```
*(Perintah ini akan berjalan terus (`--watch`) dan memperbarui file `public/style.css` secara real-time).*

### 6. Jalankan Server
Kembali ke terminal utama, jalankan backend server Express menggunakan perintah:
```bash
npm start
```
Server akan berjalan menggunakan `nodemon` (otomatis restart saat ada perubahan kode) dan Anda akan melihat tulisan: `🚀 Server berjalan di http://localhost:3000`

### 7. Akses Aplikasi
Buka browser Anda dan kunjungi URL berikut untuk mengakses aplikasi:
**http://localhost:3000**

---

## Catatan Penting
- Karena ini menggunakan Supabase PostgreSQL, pastikan server.js telah disesuaikan dari `mysql2` menggunakan `@prisma/client`.
- Foto user/barang yang diupload akan disimpan sementara di direktori `public/uploads/` secara lokal. Direktori ini di-ignore di Git agar ukuran repositori tidak membengkak.
