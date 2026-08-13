import prisma from '../config/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZReportSummary {
  from: string;
  to: string;
  generatedAt: string;
  restaurantName: string;
  branchName?: string;
  managerEmail: string;
}

interface ZReportKPI {
  totalRevenue: number;
  totalOrders: number;
  totalDiscount: number;
  averageOrderValue: number;
}

interface ZReportPaymentBreakdown {
  method: string;
  orderCount: number;
  revenue: number;
  percentage: number;
}

interface ZReportTopItem {
  rank: number;
  menuItemName: string;
  categoryName: string;
  totalQty: number;
  totalRevenue: number;
}

interface ZReportShift {
  shiftId: string;
  branchName?: string;
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
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Tổng hợp toàn bộ dữ liệu Z-Report cho khoảng thời gian từ `from` đến `to`.
 * Bao gồm: KPI doanh thu, phân tích phương thức thanh toán,
 * top 5 món bán chạy.
 */
export async function getZReportData(
  from: string,
  to: string,
  tenantId: string,
  branchId?: string
): Promise<ZReportData> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // ── 1. Lấy config nhà hàng & tên chi nhánh ──────────────────────────────
  const sysConfig = await prisma.systemConfig.findFirst({
    where: { tenantId },
    select: { restaurantName: true },
  });

  const restaurantName = sysConfig?.restaurantName ?? 'HiAI-MenuGo Restaurant';
  const managerEmail = process.env.MANAGER_EMAIL ?? 'manager@restaurant.com';

  let branchName = 'Tất cả chi nhánh';
  if (branchId) {
    const b = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });
    if (b) branchName = b.name;
  }

  // ── 2. KPI tổng quan ───────────────────────────────────────────────────────
  let kpiSql = `SELECT
       COALESCE(SUM(total), 0)          AS "totalrevenue",
       COUNT(id)                         AS "totalorders",
       COALESCE(SUM("discountAmount"), 0) AS "totaldiscount"
     FROM "Payment"
     WHERE "paidAt" >= $1 AND "paidAt" <= $2 AND "tenantId" = $3`;
  const kpiParams: any[] = [fromDate, toDate, tenantId];
  if (branchId) {
    kpiSql += ` AND "branchId" = $4`;
    kpiParams.push(branchId);
  }

  const kpiQuery: Array<{
    totalrevenue: string;
    totalorders: string;
    totaldiscount: string;
  }> = await prisma.$queryRawUnsafe(kpiSql, ...kpiParams);

  const totalRevenue = Number(kpiQuery[0]?.totalrevenue ?? 0);
  const totalOrders = Number(kpiQuery[0]?.totalorders ?? 0);
  const totalDiscount = Number(kpiQuery[0]?.totaldiscount ?? 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // ── 3. Phân tích phương thức thanh toán ────────────────────────────────────
  let paySql = `SELECT
       method,
       COUNT(id)    AS "ordercount",
       SUM(total)   AS "revenue"
     FROM "Payment"
     WHERE "paidAt" >= $1 AND "paidAt" <= $2 AND "tenantId" = $3`;
  const payParams: any[] = [fromDate, toDate, tenantId];
  if (branchId) {
    paySql += ` AND "branchId" = $4`;
    payParams.push(branchId);
  }
  paySql += ` GROUP BY method ORDER BY revenue DESC`;

  const paymentRows: Array<{
    method: string;
    ordercount: string;
    revenue: string;
  }> = await prisma.$queryRawUnsafe(paySql, ...payParams);

  const paymentBreakdown: ZReportPaymentBreakdown[] = paymentRows.map((row) => ({
    method: row.method,
    orderCount: Number(row.ordercount),
    revenue: Number(row.revenue),
    percentage: totalRevenue > 0 ? Math.round((Number(row.revenue) / totalRevenue) * 100) : 0,
  }));

  // ── 4. Top 5 món bán chạy ──────────────────────────────────────────────────
  let topSql = `SELECT
       mi.name                          AS "menuitemname",
       c.name                           AS "categoryname",
       SUM(oi.qty)                      AS "totalqty",
       SUM(oi.qty * oi."unitPrice")     AS "totalrevenue"
     FROM "OrderItem" oi
     INNER JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
     INNER JOIN "Category" c ON c.id = mi."categoryId"
     INNER JOIN "TableSession" ts ON ts.id = oi."sessionId"
     INNER JOIN "Payment" p ON p."sessionId" = ts.id
     WHERE p."paidAt" >= $1 AND p."paidAt" <= $2 AND p."tenantId" = $3
       AND oi.status NOT IN ('CART', 'VOID')`;
  const topParams: any[] = [fromDate, toDate, tenantId];
  if (branchId) {
    topSql += ` AND p."branchId" = $4`;
    topParams.push(branchId);
  }
  topSql += ` GROUP BY mi.name, c.name ORDER BY "totalqty" DESC LIMIT 5`;

  const topItemRows: Array<{
    menuitemname: string;
    categoryname: string;
    totalqty: string;
    totalrevenue: string;
  }> = await prisma.$queryRawUnsafe(topSql, ...topParams);

  const topItems: ZReportTopItem[] = topItemRows.map((row, idx) => ({
    rank: idx + 1,
    menuItemName: row.menuitemname,
    categoryName: row.categoryname,
    totalQty: Number(row.totalqty),
    totalRevenue: Number(row.totalrevenue),
  }));

  return {
    summary: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      generatedAt: new Date().toISOString(),
      restaurantName,
      branchName,
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
  };
}
