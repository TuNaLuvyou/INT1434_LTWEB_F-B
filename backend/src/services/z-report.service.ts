import prisma from '../config/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZReportSummary {
  from: string;
  to: string;
  generatedAt: string;
  restaurantName: string;
  managerEmail: string;
}

export interface ZReportKPI {
  totalRevenue: number;
  totalOrders: number;
  totalDiscount: number;
  averageOrderValue: number;
}

export interface ZReportPaymentBreakdown {
  method: string;
  orderCount: number;
  revenue: number;
  percentage: number;
}

export interface ZReportTopItem {
  rank: number;
  menuItemName: string;
  categoryName: string;
  totalQty: number;
  totalRevenue: number;
}

export interface ZReportShift {
  shiftId: string;
  cashierName: string;
  cashierEmail: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  orderCount: number;
  cashTotal: number;
  transferTotal: number;
}

export interface ZReportData {
  summary: ZReportSummary;
  kpi: ZReportKPI;
  paymentBreakdown: ZReportPaymentBreakdown[];
  topItems: ZReportTopItem[];
  shifts: ZReportShift[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Tổng hợp toàn bộ dữ liệu Z-Report cho khoảng thời gian từ `from` đến `to`.
 * Bao gồm: KPI doanh thu, phân tích phương thức thanh toán,
 * top 5 món bán chạy, và thông tin ca làm việc.
 */
export async function getZReportData(from: string, to: string): Promise<ZReportData> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // ── 1. Lấy config nhà hàng ─────────────────────────────────────────────────
  const sysConfig = await prisma.systemConfig.findFirst({
    select: { restaurantName: true },
  });

  const restaurantName = sysConfig?.restaurantName ?? 'RestoFlow Restaurant';
  const managerEmail = process.env.MANAGER_EMAIL ?? 'manager@restaurant.com';

  // ── 2. KPI tổng quan ───────────────────────────────────────────────────────
  const kpiQuery: Array<{
    totalrevenue: string;
    totalorders: string;
    totaldiscount: string;
  }> = await prisma.$queryRawUnsafe(
    `SELECT
       COALESCE(SUM(total), 0)          AS "totalrevenue",
       COUNT(id)                         AS "totalorders",
       COALESCE(SUM("discountAmount"), 0) AS "totaldiscount"
     FROM "Payment"
     WHERE "paidAt" >= $1 AND "paidAt" <= $2`,
    fromDate,
    toDate
  );

  const totalRevenue = Number(kpiQuery[0]?.totalrevenue ?? 0);
  const totalOrders = Number(kpiQuery[0]?.totalorders ?? 0);
  const totalDiscount = Number(kpiQuery[0]?.totaldiscount ?? 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // ── 3. Phân tích phương thức thanh toán ────────────────────────────────────
  const paymentRows: Array<{
    method: string;
    ordercount: string;
    revenue: string;
  }> = await prisma.$queryRawUnsafe(
    `SELECT
       method,
       COUNT(id)    AS "ordercount",
       SUM(total)   AS "revenue"
     FROM "Payment"
     WHERE "paidAt" >= $1 AND "paidAt" <= $2
     GROUP BY method
     ORDER BY revenue DESC`,
    fromDate,
    toDate
  );

  const paymentBreakdown: ZReportPaymentBreakdown[] = paymentRows.map((row) => ({
    method: row.method,
    orderCount: Number(row.ordercount),
    revenue: Number(row.revenue),
    percentage: totalRevenue > 0 ? Math.round((Number(row.revenue) / totalRevenue) * 100) : 0,
  }));

  // ── 4. Top 5 món bán chạy ──────────────────────────────────────────────────
  const topItemRows: Array<{
    menuitemname: string;
    categoryname: string;
    totalqty: string;
    totalrevenue: string;
  }> = await prisma.$queryRawUnsafe(
    `SELECT
       mi.name                          AS "menuitemname",
       c.name                           AS "categoryname",
       SUM(oi.qty)                      AS "totalqty",
       SUM(oi.qty * oi."unitPrice")     AS "totalrevenue"
     FROM "OrderItem" oi
     INNER JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
     INNER JOIN "Category" c ON c.id = mi."categoryId"
     INNER JOIN "TableSession" ts ON ts.id = oi."sessionId"
     INNER JOIN "Payment" p ON p."sessionId" = ts.id
     WHERE p."paidAt" >= $1 AND p."paidAt" <= $2
       AND oi.status NOT IN ('CART', 'VOID')
     GROUP BY mi.name, c.name
     ORDER BY "totalqty" DESC
     LIMIT 5`,
    fromDate,
    toDate
  );

  const topItems: ZReportTopItem[] = topItemRows.map((row, idx) => ({
    rank: idx + 1,
    menuItemName: row.menuitemname,
    categoryName: row.categoryname,
    totalQty: Number(row.totalqty),
    totalRevenue: Number(row.totalrevenue),
  }));

  // ── 5. Thông tin ca làm việc ───────────────────────────────────────────────
  const shiftRows = await prisma.shift.findMany({
    where: {
      openedAt: { gte: fromDate, lte: toDate },
    },
    include: {
      cashier: { select: { name: true, email: true } },
      payments: {
        where: { paidAt: { gte: fromDate, lte: toDate } },
        select: { method: true, total: true },
      },
    },
    orderBy: { openedAt: 'asc' },
  });

  const shifts: ZReportShift[] = shiftRows.map((shift) => {
    const cashTotal = shift.payments
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + Number(p.total), 0);
    const transferTotal = shift.payments
      .filter((p) => p.method === 'TRANSFER')
      .reduce((sum, p) => sum + Number(p.total), 0);

    return {
      shiftId: shift.id,
      cashierName: shift.cashier.name,
      cashierEmail: shift.cashier.email,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      status: shift.status,
      orderCount: shift.payments.length,
      cashTotal,
      transferTotal,
    };
  });

  return {
    summary: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      generatedAt: new Date().toISOString(),
      restaurantName,
      managerEmail,
    },
    kpi: {
      totalRevenue,
      totalOrders,
      totalDiscount,
      averageOrderValue,
    },
    paymentBreakdown,
    topItems,
    shifts,
  };
}
