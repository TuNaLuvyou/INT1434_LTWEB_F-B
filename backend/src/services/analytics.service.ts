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
      SUM(total) as "revenue"
    FROM "Payment"
    WHERE "paidAt" >= $1 AND "paidAt" <= $2
    GROUP BY "date"
    ORDER BY "date" ASC;
  `;

  const results = await prisma.$queryRawUnsafe<any[]>(query, fromDate, toDate);

  return results.map(r => ({
    date: r.date,
    revenue: Number(r.revenue),
  }));
};
