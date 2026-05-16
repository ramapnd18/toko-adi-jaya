const multer = require('multer');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const port = 3000;
const prisma = new PrismaClient();

// --- SUPABASE STORAGE CLIENT (Opsional) ---
// Hanya aktif jika SUPABASE_URL format valid: https://[ref].supabase.co (BUKAN sb_publishable_...)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validasi ketat: URL harus berformat https://[project-ref].supabase.co
// dan KEY harus berformat JWT (eyJ...) — bukan sb_secret_ atau placeholder
const isValidSupabaseUrl = SUPABASE_URL && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SUPABASE_URL);
const isValidSupabaseKey = SUPABASE_KEY && SUPABASE_KEY.startsWith('eyJ');
const useSupabaseStorage = isValidSupabaseUrl && isValidSupabaseKey;

let supabase = null;
if (useSupabaseStorage) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase Storage aktif — foto akan diupload ke cloud');
} else {
    console.log('⚠️  Supabase Storage tidak dikonfigurasi — foto disimpan ke lokal (public/uploads/)');
}

const BUCKET_NAME = 'foto-pengguna';

// Helper: Upload foto — ke Supabase Storage jika aktif, ke lokal jika tidak
async function handleFotoUpload(file) {
    if (!file) return null;

    if (useSupabaseStorage) {
        // Upload ke Supabase Storage
        const fileName = `${Date.now()}${path.extname(file.originalname)}`;
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });
        if (error) throw new Error(`Upload Supabase gagal: ${error.message}`);
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        return data.publicUrl;
    } else {
        // Fallback: simpan ke lokal (public/uploads/)
        const uploadDir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const fileName = `${Date.now()}${path.extname(file.originalname)}`;
        fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
        return `/uploads/${fileName}`;
    }
}

// --- KONFIGURASI MULTER (Memory Storage) ---
const upload = multer({ storage: multer.memoryStorage() });


// 1. Agar folder 'public' bisa diakses browser (untuk baca HTML & CSS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // Supaya bisa baca JSON dari frontend

// 2. Koneksi Database Supabase via Prisma
prisma.$connect()
    .then(() => console.log('✅ Terhubung ke Database Supabase (PostgreSQL)'))
    .catch((err) => console.error('❌ Gagal konek DB:', err.message));

app.get('/api/barang', async (req, res) => {
    try {
        const results = await prisma.barang.findMany({
            orderBy: { stok: 'asc' }
        });
        res.json(results);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.get('/api/laporan-stok', async (req, res) => {
    try {
        const barangs = await prisma.barang.findMany({
            include: {
                stok_masuk: true,
                stok_keluar: true
            },
            orderBy: { kode_barang: 'asc' }
        });
        
        const results = barangs.map(b => ({
            kode_barang: b.kode_barang,
            nama_barang: b.nama_barang,
            stok_saat_ini: b.stok,
            total_masuk: b.stok_masuk.reduce((sum, item) => sum + item.jumlah_masuk, 0),
            total_keluar: b.stok_keluar.reduce((sum, item) => sum + item.jumlah_keluar, 0)
        }));
        
        res.json(results);
    } catch (error) {
        console.error("Error query laporan:", error);
        res.status(500).send(error);
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN] Mencoba login dengan username: "${username}"`);
    try {
        // Cari user dengan username case-insensitive, lalu validasi password
        const user = await prisma.pengguna.findFirst({
            where: {
                username: { equals: username, mode: 'insensitive' }
            }
        });
        
        if (user && user.password === password) {
            console.log(`[LOGIN] ✅ Berhasil: ${username} (role: ${user.role})`);
            res.json({ 
                success: true, 
                message: 'Login Berhasil',
                data: {
                    id: user.id_pengguna,
                    username: user.username,
                    role: user.role,
                    nama: user.nama_lengkap,
                    foto: user.foto,       
                    password: user.password 
                }
            });
        } else {
            console.log(`[LOGIN] ❌ Gagal: username "${username}" tidak ditemukan atau password salah`);
            res.status(401).json({ success: false, message: 'Username atau Password salah!' });
        }
    } catch (error) {
        console.error('[LOGIN] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- API CHECKOUT / TRANSAKSI ---
app.post('/api/checkout', async (req, res) => {
    const { id_user, total_bayar, items } = req.body;
    const id_transaksi = `TRX-${Date.now()}`;

    try {
        // Gunakan Interactive Transaction Prisma agar aman
        await prisma.$transaction(async (tx) => {
            // 1. Simpan Header Transaksi
            await tx.transaksi.create({
                data: {
                    id_transaksi,
                    total_bayar: parseInt(total_bayar),
                    id_pengguna: parseInt(id_user)
                }
            });

            // 2. Loop setiap barang di keranjang
            for (const item of items) {
                // A. Kurangi Stok Barang
                const barang = await tx.barang.findUnique({ where: { kode_barang: item.kode } });
                if (!barang || barang.stok < item.qty) {
                    throw new Error(`Stok tidak cukup untuk barang: ${item.nama}`);
                }
                
                await tx.barang.update({
                    where: { kode_barang: item.kode },
                    data: { stok: { decrement: parseInt(item.qty) } }
                });

                // B. Simpan Detail Transaksi
                await tx.detailTransaksi.create({
                    data: {
                        id_transaksi,
                        kode_barang: item.kode,
                        jumlah_jual: parseInt(item.qty),
                        harga_satuan: parseInt(item.harga),
                        sub_total: parseInt(item.subtotal)
                    }
                });
            }
        });
        
        res.json({ success: true, id_transaksi: id_transaksi, message: 'Transaksi Berhasil!' });
    } catch (error) {
        // Jika ada error (misal stok kurang), blok transaction otomatis me-rollback
        res.status(400).json({ success: false, message: error.message });
    }
});

// --- API ADMIN: KELOLA PENGGUNA ---

// 1. Ambil Semua User
app.get('/api/users', async (req, res) => {
    try {
        const users = await prisma.pengguna.findMany();
        res.json(users);
    } catch (error) {
        res.status(500).send(error);
    }
});

// 2. Ambil SATU User (Untuk Edit/Detail)
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await prisma.pengguna.findUnique({
            where: { id_pengguna: parseInt(req.params.id) }
        });
        res.json(user);
    } catch (error) {
        res.status(500).send(error);
    }
});

// 3. Tambah User Baru (Support Upload ke Supabase Storage)
app.post('/api/users', upload.single('foto'), async (req, res) => {
    const { username, password, nama, role } = req.body;
    
    try {
        // Jika ada file diupload, upload ke Supabase Storage, jika tidak pakai placeholder
        let fotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nama)}&background=random`;
        if (req.file) {
            fotoUrl = await handleFotoUpload(req.file);
        }

        await prisma.pengguna.create({
            data: { username, password, nama_lengkap: nama, role, foto: fotoUrl }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error tambah user:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. Update User (Support Upload ke Supabase Storage)
app.put('/api/users/:id', upload.single('foto'), async (req, res) => {
    const { username, password, nama, role } = req.body;
    const id = parseInt(req.params.id);
    
    try {
        const existingUser = await prisma.pengguna.findUnique({ where: { id_pengguna: id } });
        
        // Jika ada file baru, upload ke Supabase Storage. Jika tidak, pakai foto lama.
        let fotoFinal = existingUser.foto;
        if (req.file) {
            fotoFinal = await handleFotoUpload(req.file);
        }

        await prisma.pengguna.update({
            where: { id_pengguna: id },
            data: { username, password, nama_lengkap: nama, role, foto: fotoFinal }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error update user:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 5. Hapus User
app.delete('/api/users/:id', async (req, res) => {
    try {
        await prisma.pengguna.delete({
            where: { id_pengguna: parseInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- API ADMIN: DASHBOARD STATS ---
app.get('/api/stats', async (req, res) => {
    try {
        // Ambil data agregat (sum, count) secara bersamaan (paralel)
        const [pendapatan, pengeluaran, jmlBarang, jmlTransaksi] = await Promise.all([
            prisma.transaksi.aggregate({ _sum: { total_bayar: true } }),
            prisma.pengeluaran.aggregate({ _sum: { jumlah: true } }),
            prisma.barang.count(),
            prisma.transaksi.count()
        ]);
        
        res.json({
            pendapatan: pendapatan._sum.total_bayar || 0,
            pengeluaran: pengeluaran._sum.jumlah || 0,
            stok_jenis: jmlBarang || 0,
            transaksi: jmlTransaksi || 0
        });
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- API ADMIN: HAPUS BARANG ---
app.delete('/api/barang/:kode', async (req, res) => {
    try {
        await prisma.barang.delete({
            where: { kode_barang: req.params.kode }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- API ADMIN TAMBAHAN ---

// 1. Ambil Riwayat Transaksi (Pemasukan)
app.get('/api/transaksi-list', async (req, res) => {
    try {
        const transaksi = await prisma.transaksi.findMany({
            include: { pengguna: { select: { nama_lengkap: true } } },
            orderBy: { tanggal_transaksi: 'desc' }
        });
        
        // Sesuaikan format balikan API agar sesuai dengan query JOIN di frontend lama
        const mapped = transaksi.map(t => ({
            ...t,
            kasir: t.pengguna ? t.pengguna.nama_lengkap : null
        }));
        res.json(mapped);
    } catch (error) {
        res.status(500).send(error);
    }
});

// 2. Ambil Data Pengeluaran
app.get('/api/pengeluaran', async (req, res) => {
    try {
        const pengeluaran = await prisma.pengeluaran.findMany({
            include: { pengguna: { select: { nama_lengkap: true } } },
            orderBy: { tanggal: 'desc' }
        });
        
        const mapped = pengeluaran.map(p => ({
            ...p,
            pembuat: p.pengguna ? p.pengguna.nama_lengkap : null
        }));
        res.json(mapped);
    } catch (error) {
        res.status(500).send(error);
    }
});

// 3. Tambah Pengeluaran Baru
app.post('/api/pengeluaran', async (req, res) => {
    const { nama, jumlah, keterangan, id_user } = req.body;
    try {
        await prisma.pengeluaran.create({
            data: {
                nama_pengeluaran: nama,
                jumlah: parseInt(jumlah),
                keterangan,
                id_pengguna: parseInt(id_user)
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).send(error);
    }
});

// 4. Barang Rekomendasi (Terlaris)
app.get('/api/barang-terlaris', async (req, res) => {
    try {
        const terlaris = await prisma.detailTransaksi.groupBy({
            by: ['kode_barang'],
            _sum: { jumlah_jual: true },
            orderBy: { _sum: { jumlah_jual: 'desc' } },
            take: 5
        });
        
        // Karena `groupBy` tidak otomatis join, kita fetch manual nama_barang nya
        const result = await Promise.all(terlaris.map(async (t) => {
            const barang = await prisma.barang.findUnique({ where: { kode_barang: t.kode_barang } });
            return {
                nama_barang: barang?.nama_barang || 'Unknown',
                total_terjual: t._sum.jumlah_jual
            };
        }));
        res.json(result);
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- API ADMIN: KELOLA BARANG (Lanjutan) ---

// 1. Ambil 1 Barang (Untuk Edit)
app.get('/api/barang/:kode', async (req, res) => {
    try {
        const barang = await prisma.barang.findUnique({
            where: { kode_barang: req.params.kode }
        });
        res.json(barang);
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- 2. Tambah Barang Baru ---
app.post('/api/barang', async (req, res) => {
    const { kode, nama, stok, beli, jual, id_user } = req.body;
    const totalModal = parseInt(stok) * parseInt(beli);

    try {
        await prisma.$transaction(async (tx) => {
            await tx.barang.create({
                data: {
                    kode_barang: kode,
                    nama_barang: nama,
                    stok: parseInt(stok),
                    harga_beli: parseInt(beli),
                    harga_jual: parseInt(jual)
                }
            });

            if (totalModal > 0) {
                await tx.pengeluaran.create({
                    data: {
                        nama_pengeluaran: "Belanja Stok Barang",
                        jumlah: totalModal,
                        keterangan: `Modal awal barang baru: ${nama} (${stok} unit)`,
                        id_pengguna: parseInt(id_user)
                    }
                });
            }
        });
        res.json({ success: true, message: 'Barang & Pengeluaran tercatat' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 3. Update Barang / Restock ---
app.put('/api/barang/:kode', async (req, res) => {
    const { nama, stok, beli, jual, id_user } = req.body;
    const kodeLama = req.params.kode;
    const stokBaru = parseInt(stok);
    const hargaBeliBaru = parseInt(beli);

    try {
        await prisma.$transaction(async (tx) => {
            const barangLama = await tx.barang.findUnique({ where: { kode_barang: kodeLama } });
            if (!barangLama) throw new Error('Barang tidak ditemukan');

            const selisihStok = stokBaru - barangLama.stok;

            await tx.barang.update({
                where: { kode_barang: kodeLama },
                data: {
                    nama_barang: nama,
                    stok: stokBaru,
                    harga_beli: hargaBeliBaru,
                    harga_jual: parseInt(jual)
                }
            });

            // Catat pengeluaran belanja jika restock
            if (selisihStok > 0) {
                const biayaRestock = selisihStok * hargaBeliBaru;
                await tx.pengeluaran.create({
                    data: {
                        nama_pengeluaran: "Belanja Stok Tambahan",
                        jumlah: biayaRestock,
                        keterangan: `Restock barang: ${nama} (+${selisihStok} unit)`,
                        id_pengguna: parseInt(id_user)
                    }
                });
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API UBAH PASSWORD ---
app.post('/api/change-password', async (req, res) => {
    const { id_pengguna, new_password } = req.body;

    if (!new_password || new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password minimal 6 karakter!' });
    }

    try {
        await prisma.pengguna.update({
            where: { id_pengguna: parseInt(id_pengguna) },
            data: { password: new_password }
        });
        res.json({ success: true, message: 'Password berhasil diubah!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- API ADMIN: DATA CHART TRANSAKSI (PER BULAN) ---
app.get('/api/chart-transaksi', async (req, res) => {
    try {
        // Query Postgres melalui prisma raw: 
        // DATE_FORMAT (MySQL) diganti ke TO_CHAR (PostgreSQL)
        const results = await prisma.$queryRaw`
            SELECT 
                TO_CHAR(tanggal_transaksi, 'YYYY-MM') as bulan, 
                CAST(SUM(total_bayar) AS BIGINT) as total 
            FROM transaksi 
            GROUP BY bulan 
            ORDER BY bulan ASC 
            LIMIT 6
        `;
        
        const labels = [];
        const data = [];
        
        results.forEach(row => {
            const date = new Date(row.bulan + "-01"); 
            const monthName = date.toLocaleString('id-ID', { month: 'long' });
            
            labels.push(monthName);
            // prisma query raw me-return BigInt untuk SUM di postgres, wajib dicast Number karena BigInt tidak bisa di JSON.stringify
            data.push(Number(row.total)); 
        });

        res.json({ labels, data });
    } catch (error) {
        res.status(500).send(error);
    }
});

// Jalankan server lokal (hanya saat bukan di Vercel/serverless)
// Di Vercel, 'module.exports = app' yang dipakai, bukan app.listen()
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 Server berjalan di http://localhost:${port}`);
    });
} else {
    console.log('🚀 Berjalan di mode production (Vercel Serverless)');
}

// Wajib: export app agar Vercel serverless bisa membacanya
module.exports = app;