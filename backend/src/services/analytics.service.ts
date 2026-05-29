import prisma from '../config/prisma';
import { subDays } from 'date-fns';

export const getRevenue = async (from: string, to: string, groupBy: 'day' | 'week' | 'month') => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Sử dụng PostgreSQL date_trunc để gom nhóm theo ngày/tuần/tháng.
  // Prisma $queryRawUnsafe là lựa chọn tối ưu cho việc này vì Prisma API thông thường 
  // không hỗ trợ hàm date_trunc.
  const query = `
    SELECT
      date_trunc('${groupBy}', "paidAt" AT TIME ZONE 'Asia/Ho_Chi_Minh') as "date",
      COUNT(id) as "orderCount",
      SUM(total) as "revenue"
    FROM "Payment"
    WHERE "paidAt" >= $1 AND "paidAt" <= $2
    GROUP BY "date"
    ORDER BY "date" ASC;
  `;

  const results = await prisma.$queryRawUnsafe<any[]>(query, fromDate, toDate);

  return results.map(r => ({
    date: r.date,
    orderCount: Number(r.orderCount),
    revenue: Number(r.revenue),
  }));
};

export const getPeakHours = async (from: string, to: string) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const query = `
    SELECT
      EXTRACT(ISODOW FROM "paidAt" AT TIME ZONE 'Asia/Ho_Chi_Minh') as "dayOfWeek",
      EXTRACT(HOUR FROM "paidAt" AT TIME ZONE 'Asia/Ho_Chi_Minh') as "hourOfDay",
      COUNT(id) as "orderCount",
      SUM(total) as "revenue"
    FROM "Payment"
    WHERE "paidAt" >= $1 AND "paidAt" <= $2
    GROUP BY "dayOfWeek", "hourOfDay"
    ORDER BY "dayOfWeek" ASC, "hourOfDay" ASC;
  `;

  const results = await prisma.$queryRawUnsafe<any[]>(query, fromDate, toDate);

  return results.map(r => ({
    dayOfWeek: Number(r.dayOfWeek), // 1 (Monday) to 7 (Sunday)
    hourOfDay: Number(r.hourOfDay),
    orderCount: Number(r.orderCount),
    revenue: Number(r.revenue),
  }));
};

export const getTopSellingItems = async (from?: string, to?: string, limit: number = 5) => {
  const fromDate = from ? new Date(from) : subDays(new Date(), 30);
  const toDate = to ? new Date(to) : new Date();

  // Giải thích: Tại sao dùng groupBy + join thay vì raw SQL?
  // 1. Prisma Query Engine hỗ trợ gom nhóm (groupBy) rất mạnh mẽ, trả về Type-safe data trực tiếp.
  // 2. Giúp tránh viết các chuỗi raw SQL phức tạp, dễ xảy ra lỗi Syntax và SQL Injection nếu không cẩn thận.
  // 3. Logic tách biệt (groupBy lấy ID, sau đó findMany join dữ liệu MenuItem) giúp dễ bảo trì và Prisma có thể tối ưu việc query.
  const topItems = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: {
      status: { not: 'VOID' },
      session: {
        payment: {
          paidAt: {
            gte: fromDate,
            lte: toDate
          }
        }
      }
    },
    _sum: { qty: true },
    _count: { id: true },
    orderBy: { _sum: { qty: 'desc' } },
    take: limit
  });

  if (!topItems.length) return { period: { from: fromDate, to: toDate }, items: [] };

  const menuItemIds = topItems.map(i => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { 
      id: true, 
      name: true, 
      imageUrl: true, 
      price: true,
      category: { select: { name: true } } 
    }
  });

  const items = topItems.map((item, index) => {
    const menuItem = menuItems.find(m => m.id === item.menuItemId);
    return {
      rank: index + 1,
      menuItemId: item.menuItemId,
      name: menuItem?.name || 'Unknown',
      imageUrl: menuItem?.imageUrl || null,
      categoryName: menuItem?.category?.name || 'Unknown',
      totalQty: item._sum.qty || 0,
      totalRevenue: Number(item._sum.qty || 0) * Number(menuItem?.price || 0),
      orderCount: item._count.id
    };
  });

  return { period: { from: fromDate, to: toDate }, items };
};
