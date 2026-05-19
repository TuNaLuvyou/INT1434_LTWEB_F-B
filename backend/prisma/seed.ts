import { PrismaClient, Role, TableStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. SystemConfig
  await prisma.systemConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      restaurantName: 'RestoFlow POS',
      managerEmail: 'manager@restoflow.com',
      licenseKey: 'LIC-RESTO-12345',
      licenseExpiredAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year from now
    },
  });

  // 2. User Admin
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('admin123', saltRounds);

  await prisma.user.upsert({
    where: { email: 'admin@restoflow.com' },
    update: {},
    create: {
      email: 'admin@restoflow.com',
      name: 'System Admin',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // 3. Category
  const catMain = await prisma.category.upsert({
    where: { slug: 'mon-chinh' },
    update: {},
    create: { name: 'Món chính', slug: 'mon-chinh', sortOrder: 1 },
  });

  const catDrink = await prisma.category.upsert({
    where: { slug: 'do-uong' },
    update: {},
    create: { name: 'Đồ uống', slug: 'do-uong', sortOrder: 2 },
  });

  const catDessert = await prisma.category.upsert({
    where: { slug: 'trang-mieng' },
    update: {},
    create: { name: 'Tráng miệng', slug: 'trang-mieng', sortOrder: 3 },
  });

  // 4. Menu Items
  await prisma.menuItem.create({
    data: { name: 'Phở Bò Kobe', price: 150000, categoryId: catMain.id, description: 'Phở bò đặc biệt' }
  }).catch(() => {});
  await prisma.menuItem.create({
    data: { name: 'Cơm Rang Dưa Bò', price: 65000, categoryId: catMain.id, description: 'Cơm rang giòn rụm' }
  }).catch(() => {});
  await prisma.menuItem.create({
    data: { name: 'Trà Đào Cam Sả', price: 45000, categoryId: catDrink.id, description: 'Giải nhiệt mùa hè' }
  }).catch(() => {});
  await prisma.menuItem.create({
    data: { name: 'Cà phê nâu đá', price: 30000, categoryId: catDrink.id, description: 'Cà phê pha phin truyền thống' }
  }).catch(() => {});
  await prisma.menuItem.create({
    data: { name: 'Bánh Flan', price: 25000, categoryId: catDessert.id, description: 'Bánh mềm mịn thơm béo' }
  }).catch(() => {});

  // 5. Tables
  const tableData = [
    { tableNumber: 1, label: 'Bàn 1', status: TableStatus.AVAILABLE },
    { tableNumber: 2, label: 'Bàn 2', status: TableStatus.AVAILABLE },
    { tableNumber: 3, label: 'Bàn 3', status: TableStatus.AVAILABLE },
    { tableNumber: 4, label: 'Bàn 4', status: TableStatus.AVAILABLE },
  ];

  for (const t of tableData) {
    await prisma.table.upsert({
      where: { tableNumber: t.tableNumber },
      update: {},
      create: t,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
