const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Menambahkan akun admin default...');
  
  // Cek apakah admin sudah ada
  const existingAdmin = await prisma.pengguna.findFirst({
    where: { username: 'admin' }
  });

  if (!existingAdmin) {
    await prisma.pengguna.create({
      data: {
        username: 'admin',
        password: 'password123', // Password default
        nama_lengkap: 'Administrator Utama',
        role: 'Admin',
        foto: 'https://ui-avatars.com/api/?name=Admin+Utama&background=random'
      }
    });
    console.log('✅ Berhasil membuat akun pengguna!');
    console.log('👉 Username : admin');
    console.log('👉 Password : password123');
  } else {
    console.log('✅ Akun admin sudah ada di database.');
    console.log('👉 Username : admin');
    console.log('👉 Coba gunakan password default atau ubah lewat database jika lupa.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Gagal melakukan seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
