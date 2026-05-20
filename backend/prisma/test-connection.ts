import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

async function test() {
  console.log('📡 Đang khởi tạo kết nối tới Supabase...');
  
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const userCount = await prisma.user.count();
    const tableCount = await prisma.table.count();
    const menuItemCount = await prisma.menuItem.count();
    
    console.log('\n======================================');
    console.log('🎉 KẾT NỐI THÀNH CÔNG ĐẾN SUPABASE!');
    console.log('======================================');
    console.log(`📊 Số tài khoản đã có (User): ${userCount}`);
    console.log(`📊 Số bàn ăn đã có (Table): ${tableCount}`);
    console.log(`📊 Số món ăn đã có (MenuItem): ${menuItemCount}`);
    console.log('======================================\n');
  } catch (error) {
    console.error('❌ Lỗi kết nối đến database:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

test();
