const multer = require('multer');
const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const path = require('path'); // Tambahan untuk path folder

dotenv.config();

const app = express();
const port = 3000;

// --- KONFIGURASI UPLOAD FOTO ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/'); // Folder penyimpanan
    },
    filename: (req, file, cb) => {
        // Nama file unik: timestamp + ekstensi asli (misal: 17823712.jpg)
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 1. Agar folder 'public' bisa diakses browser (untuk baca HTML & CSS)
app.use(express.static(path.join(__dirname, 'public')));

// 2. Koneksi Database
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_toko_adi_jaya'
});

db.connect((err) => {
    if (err) {
        console.error('❌ Gagal konek DB:', err.message);
    } else {
        console.log('✅ Terhubung ke Database MySQL');
    }
});

app.get('/api/barang', (req, res) => {
    const sql = 'SELECT * FROM barang ORDER BY stok DESC';
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results); // Kirim data dalam format JSON ke browser
    });
});

app.get('/api/laporan-stok', (req, res) => {
    // Query ini menggabungkan data dari 3 tabel sekaligus
    const sql = `
        SELECT 
            b.kode_barang,
            b.nama_barang,
            b.stok AS stok_saat_ini,
            -- Hitung total masuk, jika null (tidak ada data) anggap 0
            COALESCE((SELECT SUM(jumlah_masuk) FROM stok_masuk WHERE kode_barang = b.kode_barang), 0) AS total_masuk,
            -- Hitung total keluar, jika null anggap 0
            COALESCE((SELECT SUM(jumlah_keluar) FROM stok_keluar WHERE kode_barang = b.kode_barang), 0) AS total_keluar
        FROM 
            barang b
        ORDER BY 
            b.kode_barang ASC;
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error query laporan:", err);
            return res.status(500).send(err);
        }
        // Kita kirim hasil perhitungan database ke frontend
        res.json(results);
    });
});

app.use(express.json()); // Supaya bisa baca JSON dari frontend

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const sql = 'SELECT * FROM pengguna WHERE username = ? AND password = ?';
    
    // PERHATIKAN BAGIAN INI: (err, results) <- harus pakai 's' agar cocok dengan bawahnya
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Di sini kita memanggil 'results' (harus sama tulisannya dengan di atas)
        if (results.length > 0) {
            const user = results[0];
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
            res.status(401).json({ success: false, message: 'Username atau Password salah!' });
        }
    });
});

// --- API CHECKOUT / TRANSAKSI ---
app.post('/api/checkout', (req, res) => {
    const { id_user, total_bayar, items } = req.body;
    
    // Buat ID Transaksi Unik (Misal: TRX-Timestamp)
    const id_transaksi = `TRX-${Date.now()}`;

    // Mulai Transaksi Database (Agar aman, jika satu gagal, semua batal)
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: err.message });

        // 1. Simpan Header Transaksi
        const sqlTrans = 'INSERT INTO transaksi (id_transaksi, total_bayar, id_pengguna) VALUES (?, ?, ?)';
        db.query(sqlTrans, [id_transaksi, total_bayar, id_user], (err, result) => {
            if (err) {
                return db.rollback(() => res.status(500).json({ error: err.message }));
            }

            // 2. Loop setiap barang di keranjang
            const processItems = items.map(item => {
                return new Promise((resolve, reject) => {
                    // A. Kurangi Stok Barang
                    const sqlUpdateStok = 'UPDATE barang SET stok = stok - ? WHERE kode_barang = ? AND stok >= ?';
                    db.query(sqlUpdateStok, [item.qty, item.kode, item.qty], (err, result) => {
                        if (err || result.affectedRows === 0) {
                            // Jika affectedRows 0, berarti stok tidak cukup saat update
                            return reject(`Stok tidak cukup untuk barang: ${item.nama}`);
                        }

                        // B. Simpan Detail Transaksi
                        const sqlDetail = 'INSERT INTO detail_transaksi (id_transaksi, kode_barang, jumlah_jual, harga_satuan, sub_total) VALUES (?, ?, ?, ?, ?)';
                        db.query(sqlDetail, [id_transaksi, item.kode, item.qty, item.harga, item.subtotal], (err, result) => {
                            if (err) return reject(err.message);
                            resolve();
                        });
                    });
                });
            });

            // Jalankan semua proses item
            Promise.all(processItems)
                .then(() => {
                    // Jika semua sukses, COMMIT (Simpan permanen)
                    db.commit(err => {
                        if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                        res.json({ success: true, id_transaksi: id_transaksi, message: 'Transaksi Berhasil!' });
                    });
                })
                .catch(error => {
                    // Jika ada satu error (misal stok kurang), ROLLBACK (Batalkan semua)
                    db.rollback(() => res.status(400).json({ success: false, message: error }));
                });
        });
    });
});

// --- API ADMIN: KELOLA PENGGUNA ---

// 1. Ambil Semua User
app.get('/api/users', (req, res) => {
    db.query('SELECT * FROM pengguna', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// 2. Ambil SATU User (Untuk Edit/Detail)
app.get('/api/users/:id', (req, res) => {
    db.query('SELECT * FROM pengguna WHERE id_pengguna = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results[0]);
    });
});

// 3. Tambah User Baru (Support Upload)
// 'foto' adalah nama field di form HTML nanti
app.post('/api/users', upload.single('foto'), (req, res) => {
    const { username, password, nama, role } = req.body;
    
    // Jika ada file diupload, pakai path-nya. Jika tidak, pakai gambar default.
    const fotoPath = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/150';
    
    const sql = 'INSERT INTO pengguna (username, password, nama_lengkap, role, foto) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [username, password, nama, role, fotoPath], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});

// 4. Update User (Support Upload)
app.put('/api/users/:id', upload.single('foto'), (req, res) => {
    const { username, password, nama, role } = req.body;
    const id = req.params.id;
    
    // Cek dulu user lama untuk ambil foto lama jika user tidak upload foto baru
    db.query('SELECT foto FROM pengguna WHERE id_pengguna = ?', [id], (err, results) => {
        if (err) return res.status(500).send(err);
        
        // Jika user upload foto baru (req.file ada), pakai itu. 
        // Jika tidak, pakai foto lama dari database.
        const fotoFinal = req.file ? `/uploads/${req.file.filename}` : results[0].foto;

        const sql = 'UPDATE pengguna SET username=?, password=?, nama_lengkap=?, role=?, foto=? WHERE id_pengguna=?';
        db.query(sql, [username, password, nama, role, fotoFinal, id], (err, result) => {
            if (err) return res.status(500).send(err);
            res.json({ success: true });
        });
    });
});

// 5. Hapus User
app.delete('/api/users/:id', (req, res) => {
    const sql = 'DELETE FROM pengguna WHERE id_pengguna = ?';
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});

// --- API ADMIN: DASHBOARD STATS ---
app.get('/api/stats', (req, res) => {
    const sqlPendapatan = 'SELECT SUM(total_bayar) as total FROM transaksi';
    const sqlPengeluaran = 'SELECT SUM(jumlah) as total FROM pengeluaran';
    const sqlJmlBarang = 'SELECT COUNT(*) as total FROM barang';
    const sqlJmlTransaksi = 'SELECT COUNT(*) as total FROM transaksi';

    // Jalankan query secara paralel (sederhana)
    db.query(sqlPendapatan, (err, res1) => {
        db.query(sqlPengeluaran, (err, res2) => {
            db.query(sqlJmlBarang, (err, res3) => {
                db.query(sqlJmlTransaksi, (err, res4) => {
                    res.json({
                        pendapatan: res1[0].total || 0,
                        pengeluaran: res2[0].total || 0,
                        stok_jenis: res3[0].total || 0,
                        transaksi: res4[0].total || 0
                    });
                });
            });
        });
    });
});

// --- API ADMIN: HAPUS BARANG ---
app.delete('/api/barang/:kode', (req, res) => {
    const sql = 'DELETE FROM barang WHERE kode_barang = ?';
    db.query(sql, [req.params.kode], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});

// --- API ADMIN TAMBAHAN ---

// 1. Ambil Riwayat Transaksi (Pemasukan)
app.get('/api/transaksi-list', (req, res) => {
    // Join dengan tabel pengguna untuk tahu siapa kasirnya
    const sql = `
        SELECT t.*, p.nama_lengkap as kasir 
        FROM transaksi t 
        LEFT JOIN pengguna p ON t.id_pengguna = p.id_pengguna 
        ORDER BY t.tanggal_transaksi DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// 2. Ambil Data Pengeluaran
app.get('/api/pengeluaran', (req, res) => {
    const sql = 'SELECT * FROM pengeluaran ORDER BY tanggal DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// 3. Tambah Pengeluaran Baru
app.post('/api/pengeluaran', (req, res) => {
    const { nama, jumlah, keterangan } = req.body;
    const sql = 'INSERT INTO pengeluaran (nama_pengeluaran, jumlah, keterangan) VALUES (?, ?, ?)';
    db.query(sql, [nama, jumlah, keterangan], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});

// 4. Barang Rekomendasi (Terlaris)
app.get('/api/barang-terlaris', (req, res) => {
    const sql = `
        SELECT b.nama_barang, SUM(dt.jumlah_jual) as total_terjual 
        FROM detail_transaksi dt
        JOIN barang b ON dt.kode_barang = b.kode_barang
        GROUP BY dt.kode_barang
        ORDER BY total_terjual DESC
        LIMIT 5
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// --- API ADMIN: KELOLA BARANG (Lanjutan) ---

// 1. Ambil 1 Barang (Untuk Edit)
app.get('/api/barang/:kode', (req, res) => {
    const sql = 'SELECT * FROM barang WHERE kode_barang = ?';
    db.query(sql, [req.params.kode], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result[0]);
    });
});

// 2. Tambah Barang Baru
app.post('/api/barang', (req, res) => {
    const { kode, nama, stok, beli, jual } = req.body;
    const sql = 'INSERT INTO barang (kode_barang, nama_barang, stok, harga_beli, harga_jual) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [kode, nama, stok, beli, jual], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});

// 3. Update Barang
app.put('/api/barang/:kode', (req, res) => {
    const { nama, stok, beli, jual } = req.body;
    const kodeLama = req.params.kode;
    const sql = 'UPDATE barang SET nama_barang=?, stok=?, harga_beli=?, harga_jual=? WHERE kode_barang=?';
    db.query(sql, [nama, stok, beli, jual, kodeLama], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});

// 3. Jalankan Server
app.listen(port, () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
});