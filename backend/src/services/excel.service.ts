import ExcelJS from 'exceljs';
import prisma from '../config/prisma';
import { getRevenue } from './analytics.service';
import { Response } from 'express';

export class ExcelService {
  async generateRevenueReport(res: Response, from: Date, to: Date, type: 'full' | 'summary'): Promise<void> {
    console.time('[Excel] generate');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HiAI-MenuGo System';
    workbook.created = new Date();

    await this.buildRevenueSummarySheet(workbook, from, to);

    if (type === 'full') {
      await this.buildOrderDetailsSheet(workbook, from, to);
      await this.buildBestSellersSheet(workbook, from, to);
      await this.buildShiftSummarySheet(workbook, from, to);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="hiaimenugo-report-${from.toISOString().split('T')[0]}-${to.toISOString().split('T')[0]}.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();
    console.timeEnd('[Excel] generate');
  }

  private async buildRevenueSummarySheet(wb: ExcelJS.Workbook, from: Date, to: Date): Promise<void> {
    const sheet = wb.addWorksheet('Tổng quan doanh thu');
    sheet.protect('hiaimenugo', { selectLockedCells: true });

    sheet.columns = [
      { header: 'Ngày', key: 'date', width: 15 },
      { header: 'Tổng đơn', key: 'orderCount', width: 12 },
      { header: 'Doanh thu (VND)', key: 'revenue', width: 18 },
      { header: 'Tiền mặt', key: 'cash', width: 18 },
      { header: 'Chuyển khoản', key: 'transfer', width: 18 },
      { header: 'Giảm giá', key: 'discount', width: 18 },
      { header: 'Doanh thu thuần', key: 'netRevenue', width: 18 }
    ];

    const headerRow = sheet.getRow(1);
    this.applyHeaderStyle(headerRow);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const dailyData = await getRevenue(from.toISOString(), to.toISOString(), 'day');
    
    // Thêm query lấy chi tiết cash, transfer, discount
    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: from, lte: to } }
    });

    const paymentByDay = payments.reduce((acc, p) => {
      const d = p.paidAt.toISOString().split('T')[0];
      if (!acc[d]) acc[d] = { cash: 0, transfer: 0, discount: 0 };
      if (p.method === 'CASH') acc[d].cash += Number(p.total);
      if (p.method === 'TRANSFER') acc[d].transfer += Number(p.total);
      acc[d].discount += Number(p.discountAmount);
      return acc;
    }, {} as Record<string, any>);

    let rowIndex = 2;
    for (const d of dailyData) {
      const dateStr = new Date(d.date).toISOString().split('T')[0];
      const detail = paymentByDay[dateStr] || { cash: 0, transfer: 0, discount: 0 };
      
      const row = sheet.addRow({
        date: new Date(d.date),
        orderCount: d.orderCount,
        revenue: d.revenue + detail.discount, // Doanh thu gộp
        cash: detail.cash,
        transfer: detail.transfer,
        discount: detail.discount,
        netRevenue: d.revenue // Doanh thu thuần sau giảm giá
      });
      
      row.getCell('date').numFmt = 'dd/mm/yyyy';
      ['revenue', 'cash', 'transfer', 'discount', 'netRevenue'].forEach(key => {
        row.getCell(key as string).numFmt = '#,##0';
      });
      
      this.applyAlternateRowStyle(row, rowIndex);
      rowIndex++;
    }

    const lastRowIdx = Math.max(2, rowIndex - 1);
    
    // TỔNG CỘNG
    const footerRow = sheet.addRow({
      date: 'TỔNG CỘNG',
      orderCount: { formula: `SUM(B2:B${lastRowIdx})` },
      revenue: { formula: `SUM(C2:C${lastRowIdx})` },
      cash: { formula: `SUM(D2:D${lastRowIdx})` },
      transfer: { formula: `SUM(E2:E${lastRowIdx})` },
      discount: { formula: `SUM(F2:F${lastRowIdx})` },
      netRevenue: { formula: `SUM(G2:G${lastRowIdx})` }
    });

    footerRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      if (Number(cell.col) > 2) cell.numFmt = '#,##0';
    });
  }

  private async buildOrderDetailsSheet(wb: ExcelJS.Workbook, from: Date, to: Date): Promise<void> {
    const sheet = wb.addWorksheet('Chi tiết đơn hàng');
    sheet.protect('hiaimenugo', { selectLockedCells: true });

    sheet.columns = [
      { header: 'Mã đơn', key: 'id', width: 25 },
      { header: 'Bàn', key: 'table', width: 10 },
      { header: 'Thời gian', key: 'time', width: 20 },
      { header: 'Ca', key: 'shift', width: 25 },
      { header: 'Thu ngân', key: 'cashier', width: 15 },
      { header: 'Món', key: 'items', width: 40 },
      { header: 'Số lượng', key: 'qty', width: 10 },
      { header: 'Đơn giá (TB)', key: 'unitPrice', width: 15 },
      { header: 'Thành tiền', key: 'subtotal', width: 15 },
      { header: 'Giảm giá', key: 'discount', width: 15 },
      { header: 'Tổng', key: 'total', width: 15 },
      { header: 'Phương thức', key: 'method', width: 15 },
      { header: 'Voucher', key: 'voucher', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    this.applyHeaderStyle(headerRow);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const diffDays = (to.getTime() - from.getTime()) / (1000 * 3600 * 24);
    const limit = diffDays > 90 ? 1000 : undefined;

    if (limit) {
      sheet.insertRow(1, ['Hiển thị 1000 đơn đầu tiên. Rút ngắn khoảng thời gian để xem đầy đủ.']);
      sheet.mergeCells('A1:M1');
      sheet.getRow(1).font = { color: { argb: 'FFFF0000' }, italic: true };
    }

    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { gte: from, lte: to }
      },
      include: {
        session: {
          include: {
            table: { select: { tableNumber: true, label: true } },
            orderItems: {
              where: { status: { not: 'VOID' } },
              include: { menuItem: { select: { name: true } } }
            }
          }
        },
        shift: {
          include: { cashier: { select: { name: true } } }
        },
        voucher: { select: { code: true } }
      },
      orderBy: { paidAt: 'asc' },
      take: limit
    });

    let rowIndex = limit ? 3 : 2;
    for (const p of payments) {
      const itemsStr = p.session.orderItems.map(oi => `${oi.menuItem.name} x${oi.qty}`).join(', ');
      const totalQty = p.session.orderItems.reduce((acc, oi) => acc + oi.qty, 0);
      
      const row = sheet.addRow({
        id: p.id,
        table: p.session.table.label,
        time: p.paidAt,
        shift: p.shiftId,
        cashier: p.shift.cashier.name,
        items: itemsStr,
        qty: totalQty,
        unitPrice: totalQty > 0 ? Number(p.subtotal) / totalQty : 0,
        subtotal: Number(p.subtotal),
        discount: Number(p.discountAmount),
        total: Number(p.total),
        method: p.method,
        voucher: p.voucher?.code || ''
      });

      row.getCell('time').numFmt = 'dd/mm/yyyy hh:mm';
      ['unitPrice', 'subtotal', 'discount', 'total'].forEach(key => {
        row.getCell(key as string).numFmt = '#,##0';
      });

      this.applyAlternateRowStyle(row, rowIndex);
      rowIndex++;
    }
  }

  private async buildBestSellersSheet(wb: ExcelJS.Workbook, from: Date, to: Date): Promise<void> {
    const sheet = wb.addWorksheet('Top món bán chạy');
    sheet.protect('hiaimenugo', { selectLockedCells: true });

    sheet.columns = [
      { header: 'Hạng', key: 'rank', width: 8 },
      { header: 'Tên món', key: 'name', width: 25 },
      { header: 'Danh mục', key: 'category', width: 15 },
      { header: 'Số lượng bán', key: 'qty', width: 15 },
      { header: 'Doanh thu (VND)', key: 'revenue', width: 18 },
      { header: '% tổng doanh thu', key: 'percent', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    this.applyHeaderStyle(headerRow);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const orderItems = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        status: { not: 'VOID' },
        session: {
          payment: {
            paidAt: { gte: from, lte: to }
          }
        }
      },
      _sum: {
        qty: true,
        unitPrice: true
      }
    });

    let totalRevenue = 0;
    const itemStats = await Promise.all(orderItems.map(async (oi) => {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: oi.menuItemId },
        include: { category: true }
      });
      const rev = Number(oi._sum.unitPrice || 0) * Number(oi._sum.qty || 0); // approx
      totalRevenue += rev;
      return {
        name: menuItem?.name || 'Unknown',
        category: menuItem?.category.name || 'Unknown',
        qty: Number(oi._sum.qty || 0),
        revenue: rev
      };
    }));

    itemStats.sort((a, b) => b.qty - a.qty);

    let rowIndex = 2;
    for (const [idx, item] of itemStats.entries()) {
      const row = sheet.addRow({
        rank: idx + 1,
        name: item.name,
        category: item.category,
        qty: item.qty,
        revenue: item.revenue,
        percent: totalRevenue > 0 ? (item.revenue / totalRevenue) : 0
      });

      row.getCell('revenue').numFmt = '#,##0';
      row.getCell('percent').numFmt = '0.00%';
      this.applyAlternateRowStyle(row, rowIndex);
      rowIndex++;
    }

    try {
      const anySheet = sheet as any;
      if (typeof anySheet.addChart === 'function') {
        const lastRow = Math.max(2, rowIndex - 1);
        const chart = anySheet.addChart({
          type: 'bar',
          series: [{ name: 'Số lượng', ref: `D2:D${lastRow}`, categories: `B2:B${lastRow}` }],
          title: 'Top món bán chạy',
          plotArea: { barChart: { barDir: 'bar' } }
        });
        anySheet.addImage(chart, 'G1:M20');
      }
    } catch (e) {
      console.warn('ExcelJS addChart not supported in this version');
    }
  }

  private async buildShiftSummarySheet(wb: ExcelJS.Workbook, from: Date, to: Date): Promise<void> {
    const sheet = wb.addWorksheet('Báo cáo ca');
    sheet.protect('hiaimenugo', { selectLockedCells: true });

    sheet.columns = [
      { header: 'Ca', key: 'id', width: 20 },
      { header: 'Thu ngân', key: 'cashier', width: 20 },
      { header: 'Mở ca', key: 'openedAt', width: 20 },
      { header: 'Đóng ca', key: 'closedAt', width: 20 },
      { header: 'Tiền lẻ đầu ca', key: 'openFloat', width: 18 },
      { header: 'Thu tiền mặt', key: 'cashTotal', width: 18 },
      { header: 'Thu chuyển khoản', key: 'transferTotal', width: 18 },
      { header: 'Số đơn', key: 'orderCount', width: 10 },
      { header: 'Tổng doanh thu', key: 'total', width: 18 },
    ];

    const headerRow = sheet.getRow(1);
    this.applyHeaderStyle(headerRow);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const shifts = await prisma.shift.findMany({
      where: {
        closedAt: { gte: from, lte: to }
      },
      include: { cashier: true },
      orderBy: { closedAt: 'asc' }
    });

    let rowIndex = 2;
    for (const s of shifts) {
      const row = sheet.addRow({
        id: s.id,
        cashier: s.cashier.name,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openFloat: Number(s.openFloat),
        cashTotal: Number(s.cashTotal || 0),
        transferTotal: Number(s.transferTotal || 0),
        orderCount: s.orderCount || 0,
        total: Number(s.cashTotal || 0) + Number(s.transferTotal || 0)
      });

      row.getCell('openedAt').numFmt = 'dd/mm/yyyy hh:mm';
      if (s.closedAt) row.getCell('closedAt').numFmt = 'dd/mm/yyyy hh:mm';
      ['openFloat', 'cashTotal', 'transferTotal', 'total'].forEach(key => {
        row.getCell(key as string).numFmt = '#,##0';
      });

      this.applyAlternateRowStyle(row, rowIndex);
      rowIndex++;
    }
  }

  private applyHeaderStyle(row: ExcelJS.Row): void {
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    });
  }

  private applyAlternateRowStyle(row: ExcelJS.Row, rowIndex: number): void {
    if (rowIndex % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      });
    }
  }
}
