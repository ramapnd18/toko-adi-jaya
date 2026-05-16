const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.pengguna.findMany()
  .then(users => {
    console.log('Users in DB:');
    users.forEach(u => console.log(`  id=${u.id_pengguna}, username="${u.username}", password="${u.password}", role="${u.role}"`));
    if (users.length === 0) console.log('  (tidak ada user di database!)');
  })
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
