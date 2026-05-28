import prisma from '../config/prisma';

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
