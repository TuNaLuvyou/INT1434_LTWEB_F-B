import { PrismaClient, Role, TableStatus, DiscountType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Bắt đầu quá trình seed dữ liệu...');

  // BƯỚC 1: SystemConfig
  await prisma.systemConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      restaurantName: 'RestoFlow Demo',
      managerEmail: 'manager@restoflow.demo',
      licenseKey: 'RF-DEMO-2025-XXXX',
      licenseExpiredAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1 year
    },
  });
  console.log('✅ SystemConfig created');

  // BƯỚC 2: User
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('Demo@1234', saltRounds);

  const users = [
    { email: 'admin@restoflow.demo', role: Role.ADMIN, name: 'Admin RestoFlow' },
    { email: 'manager@restoflow.demo', role: Role.MANAGER, name: 'Nguyễn Văn Manager' },
    { email: 'kitchen@restoflow.demo', role: Role.KITCHEN, name: 'Bếp Trưởng' },
    { email: 'staff@restoflow.demo', role: Role.STAFF, name: 'Nhân Viên RestoFlow' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
      },
    });
  }
  console.log('✅ Users created');

  // BƯỚC 3: Category
  const categories = [
    { name: 'Món chính', slug: 'mon-chinh', sortOrder: 1 },
    { name: 'Đồ uống', slug: 'do-uong', sortOrder: 2 },
    { name: 'Tráng miệng', slug: 'trang-mieng', sortOrder: 3 },
  ];

  const categoryMap: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    categoryMap[c.slug] = cat.id;
  }
  console.log('✅ Categories created');

  // BƯỚC 4: MenuItem
  const menuItems = [
    { name: 'Phở bò đặc biệt', price: 85000, description: 'Phở bò truyền thống, nước dùng hầm 12 tiếng', categoryId: categoryMap['mon-chinh'] },
    { name: 'Bún bò Huế', price: 75000, description: 'Bún bò cay đặc trưng miền Trung', categoryId: categoryMap['mon-chinh'] },
    { name: 'Cà phê sữa đá', price: 35000, description: 'Cà phê Robusta pha phin truyền thống', categoryId: categoryMap['do-uong'] },
    { name: 'Nước chanh tươi', price: 25000, description: 'Chanh tươi, đường, đá viên', categoryId: categoryMap['do-uong'] },
    { name: 'Chè đậu xanh', price: 30000, description: 'Chè đậu xanh đánh bông mịn', categoryId: categoryMap['trang-mieng'] },
    { name: 'Bánh flan', price: 35000, description: 'Bánh flan caramel mềm mịn', categoryId: categoryMap['trang-mieng'] },
  ];

  const menuItemMap: Record<string, string> = {};
  for (const m of menuItems) {
    const existing = await prisma.menuItem.findFirst({ where: { name: m.name } });
    if (existing) {
      menuItemMap[m.name] = existing.id;
    } else {
      const created = await prisma.menuItem.create({ data: m });
      menuItemMap[m.name] = created.id;
    }
  }
  console.log('✅ MenuItems created');

  // BƯỚC 5: Table
  const tables = [
    { tableNumber: 1, label: 'Bàn 1 - Tầng trệt', status: TableStatus.AVAILABLE },
    { tableNumber: 2, label: 'Bàn 2 - Tầng trệt', status: TableStatus.AVAILABLE },
    { tableNumber: 3, label: 'Bàn 3 - Tầng lửng', status: TableStatus.AVAILABLE },
    { tableNumber: 4, label: 'Bàn VIP', status: TableStatus.AVAILABLE },
  ];

  for (const t of tables) {
    await prisma.table.upsert({
      where: { tableNumber: t.tableNumber },
      update: {},
      create: t,
    });
  }
  console.log('✅ Tables created');

  // BƯỚC 6: Ingredient
  const ingredients = [
    { name: 'Bánh phở', unit: 'gram', stock: 5000, minStock: 500 },
    { name: 'Thịt bò', unit: 'gram', stock: 3000, minStock: 300 },
    { name: 'Cà phê', unit: 'gram', stock: 2000, minStock: 200 },
    { name: 'Đường', unit: 'gram', stock: 10000, minStock: 1000 },
    { name: 'Sữa đặc', unit: 'ml', stock: 5000, minStock: 500 },
  ];

  const ingredientMap: Record<string, string> = {};
  for (const i of ingredients) {
    const existing = await prisma.ingredient.findFirst({ where: { name: i.name } });
    if (existing) {
      ingredientMap[i.name] = existing.id;
    } else {
      const created = await prisma.ingredient.create({ data: i });
      ingredientMap[i.name] = created.id;
    }
  }
  console.log('✅ Ingredients created');

  // BƯỚC 7: BOM
  const boms = [
    // Phở bò đặc biệt
    { menuItemId: menuItemMap['Phở bò đặc biệt'], ingredientId: ingredientMap['Bánh phở'], quantity: 200 },
    { menuItemId: menuItemMap['Phở bò đặc biệt'], ingredientId: ingredientMap['Thịt bò'], quantity: 150 },
    // Cà phê sữa đá
    { menuItemId: menuItemMap['Cà phê sữa đá'], ingredientId: ingredientMap['Cà phê'], quantity: 20 },
    { menuItemId: menuItemMap['Cà phê sữa đá'], ingredientId: ingredientMap['Đường'], quantity: 30 },
    { menuItemId: menuItemMap['Cà phê sữa đá'], ingredientId: ingredientMap['Sữa đặc'], quantity: 40 },
  ];

  for (const b of boms) {
    if (b.menuItemId && b.ingredientId) {
      await prisma.bOM.upsert({
        where: {
          menuItemId_ingredientId: {
            menuItemId: b.menuItemId,
            ingredientId: b.ingredientId,
          },
        },
        update: {},
        create: b,
      });
    }
  }
  console.log('✅ BOM created');

  // BƯỚC 8: Voucher
  const vouchers = [
    { code: 'WELCOME10', discountType: DiscountType.PERCENT, discountValue: 10, maxUsage: 100, isActive: true },
    { code: 'FIXED50K', discountType: DiscountType.FIXED, discountValue: 50000, maxUsage: 50, isActive: true },
  ];

  for (const v of vouchers) {
    await prisma.voucher.upsert({
      where: { code: v.code },
      update: {},
      create: v,
    });
  }
  console.log('✅ Vouchers created');

  console.log('🎉 Seed dữ liệu hoàn tất!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
