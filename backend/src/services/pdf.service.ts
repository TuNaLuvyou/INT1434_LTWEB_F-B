import PDFDocument from 'pdfkit';
import { ZReportData } from './z-report.service';
import fs from 'fs';

// ─── Font Configuration ───────────────────────────────────────────────────────
// Built-in standard PDF fonts like Helvetica DO NOT support Vietnamese UTF-8 glyphs.
// We auto-detect and load the system Arial font which has perfect Vietnamese support,
// falling back to Helvetica if not found to prevent system crashes.
const winFontRegular = 'C:\\Windows\\Fonts\\arial.ttf';
const winFontBold = 'C:\\Windows\\Fonts\\arialbd.ttf';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format số tiền thành chuỗi VND (ví dụ: 1.250.000 VND) */
function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN') + ' VND';
}

/** Format ISO date string thành dd/MM/yyyy HH:mm */
function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Vẽ một đường kẻ ngang */
function drawHorizontalRule(doc: PDFKit.PDFDocument, y: number): void {
  doc
    .strokeColor('#e5e7eb')
    .lineWidth(0.5)
    .moveTo(50, y)
    .lineTo(doc.page.width - 50, y)
    .stroke();
}

/** Vẽ tiêu đề section */
function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number, fontBold: string): void {
  doc
    .fillColor('#1e40af')
    .rect(50, y, doc.page.width - 100, 22)
    .fill();
  doc
    .fillColor('#ffffff')
    .fontSize(9)
    .font(fontBold)
    .text(title.toUpperCase(), 58, y + 6);
}

// ─── Main Generator ──────────────────────────────────────────────────────────

/**
 * Tạo PDF Z-Report từ dữ liệu `ZReportData` và trả về Buffer.
 * Sử dụng pdfkit để tạo file PDF thuần Node.js, không cần DOM.
 */
export async function generateZReportPDF(data: ZReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Register Arial fonts if they exist to support Vietnamese Unicode
    let fontRegular = 'Helvetica';
    let fontBold = 'Helvetica-Bold';

    if (fs.existsSync(winFontRegular) && fs.existsSync(winFontBold)) {
      doc.registerFont('Arial-Regular', winFontRegular);
      doc.registerFont('Arial-Bold', winFontBold);
      fontRegular = 'Arial-Regular';
      fontBold = 'Arial-Bold';
    }

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100;

    // ── HEADER ──────────────────────────────────────────────────────────────
    // Background header
    doc.fillColor('#1e3a8a').rect(0, 0, pageWidth, 90).fill();

    // Restaurant name
    doc
      .fillColor('#ffffff')
      .font(fontBold)
      .fontSize(20)
      .text(data.summary.restaurantName, 50, 20, { width: contentWidth, align: 'left' });

    // Report title
    doc
      .fillColor('#93c5fd')
      .font(fontBold)
      .fontSize(10)
      .text('Z-REPORT — BÁO CÁO TỔNG KẾT CA', 50, 48, { width: contentWidth, align: 'left' });

    // Generated date (right side)
    doc
      .fillColor('#bfdbfe')
      .font(fontRegular)
      .fontSize(8)
      .text(`Xuất lúc: ${formatDateTime(data.summary.generatedAt)}`, 50, 68, {
        width: contentWidth,
        align: 'right',
      });

    // ── REPORT PERIOD ────────────────────────────────────────────────────────
    let y = 110;
    doc
      .fillColor('#374151')
      .font(fontRegular)
      .fontSize(9)
      .text(`Kỳ báo cáo:   ${formatDateTime(data.summary.from)}  →  ${formatDateTime(data.summary.to)}`, 50, y);

    doc
      .fillColor('#6b7280')
      .fontSize(8)
      .text(`Gửi tới Manager: ${data.summary.managerEmail}`, 50, y + 14);

    drawHorizontalRule(doc, y + 32);

    // ── KPI CARDS ────────────────────────────────────────────────────────────
    y = y + 45;
    drawSectionTitle(doc, '  Tổng Quan Doanh Thu', y, fontBold);
    y += 32;

    const kpiItems = [
      { label: 'Tổng Doanh Thu', value: formatCurrency(data.kpi.totalRevenue), color: '#16a34a' },
      { label: 'Số Đơn Hoàn Thành', value: `${data.kpi.totalOrders} đơn`, color: '#2563eb' },
      { label: 'Tổng Giảm Giá', value: formatCurrency(data.kpi.totalDiscount), color: '#dc2626' },
      { label: 'Giá Trị TB/Đơn', value: formatCurrency(Math.round(data.kpi.averageOrderValue)), color: '#7c3aed' },
    ];

    const cardWidth = (contentWidth - 15) / 4;
    kpiItems.forEach((item, i) => {
      const x = 50 + i * (cardWidth + 5);
      // Card background
      doc.fillColor('#f8fafc').rect(x, y, cardWidth, 52).fill();
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(x, y, cardWidth, 52).stroke();
      // Label
      doc.fillColor('#6b7280').font(fontRegular).fontSize(7).text(item.label, x + 8, y + 8, { width: cardWidth - 16 });
      // Value
      doc.fillColor(item.color).font(fontBold).fontSize(10).text(item.value, x + 8, y + 22, { width: cardWidth - 16 });
    });

    y += 68;

    // ── PAYMENT BREAKDOWN ────────────────────────────────────────────────────
    drawSectionTitle(doc, '  Phương Thức Thanh Toán', y, fontBold);
    y += 32;

    // Table header
    const colWidths = [130, 100, 130, 80];
    const headers = ['Phương Thức', 'Số Đơn', 'Doanh Thu', 'Tỷ Lệ'];
    let x = 50;
    doc.fillColor('#f1f5f9').rect(50, y - 4, contentWidth, 18).fill();
    headers.forEach((h, i) => {
      doc.fillColor('#374151').font(fontBold).fontSize(8).text(h, x + 4, y + 1, { width: colWidths[i] });
      x += colWidths[i];
    });
    y += 20;

    const methodLabels: Record<string, string> = { CASH: 'Tiền Mặt (CASH)', TRANSFER: 'Chuyển Khoản (TRANSFER)' };
    data.paymentBreakdown.forEach((row, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.fillColor(rowBg).rect(50, y - 3, contentWidth, 18).fill();
      const cols = [
        methodLabels[row.method] ?? row.method,
        `${row.orderCount}`,
        formatCurrency(row.revenue),
        `${row.percentage}%`,
      ];
      x = 50;
      cols.forEach((val, i) => {
        doc.fillColor('#374151').font(fontRegular).fontSize(8).text(val, x + 4, y + 1, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 20;
    });

    if (data.paymentBreakdown.length === 0) {
      doc.fillColor('#9ca3af').font(fontRegular).fontSize(8).text('Không có dữ liệu thanh toán trong kỳ.', 54, y);
      y += 20;
    }
    y += 10;

    // ── TOP ITEMS ────────────────────────────────────────────────────────────
    drawSectionTitle(doc, '  Top 5 Món Bán Chạy', y, fontBold);
    y += 32;

    const topCols = [40, 180, 110, 80, 110];
    const topHeaders = ['#', 'Tên Món', 'Danh Mục', 'SL Bán', 'Doanh Thu'];
    x = 50;
    doc.fillColor('#f1f5f9').rect(50, y - 4, contentWidth, 18).fill();
    topHeaders.forEach((h, i) => {
      doc.fillColor('#374151').font(fontBold).fontSize(8).text(h, x + 4, y + 1, { width: topCols[i] });
      x += topCols[i];
    });
    y += 20;

    data.topItems.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.fillColor(rowBg).rect(50, y - 3, contentWidth, 18).fill();
      const cols = [`${item.rank}`, item.menuItemName, item.categoryName, `${item.totalQty}`, formatCurrency(item.totalRevenue)];
      x = 50;
      cols.forEach((val, i) => {
        doc.fillColor('#374151').font(fontRegular).fontSize(8).text(val, x + 4, y + 1, { width: topCols[i] });
        x += topCols[i];
      });
      y += 20;
    });

    if (data.topItems.length === 0) {
      doc.fillColor('#9ca3af').font(fontRegular).fontSize(8).text('Không có dữ liệu món ăn trong kỳ.', 54, y);
      y += 20;
    }
    y += 10;

    // ── SHIFTS ───────────────────────────────────────────────────────────────
    // Kiểm tra còn đủ chỗ không, nếu không thì thêm trang mới
    if (y > doc.page.height - 180) {
      doc.addPage();
      y = 50;
    }

    drawSectionTitle(doc, '  Thông Tin Ca Làm Việc', y, fontBold);
    y += 32;

    const shiftCols = [120, 80, 110, 80, 80, 70];
    const shiftHeaders = ['Thu Ngân', 'Trạng Thái', 'Giờ Mở Ca', 'SL Đơn', 'Tiền Mặt', 'CK'];
    x = 50;
    doc.fillColor('#f1f5f9').rect(50, y - 4, contentWidth, 18).fill();
    shiftHeaders.forEach((h, i) => {
      doc.fillColor('#374151').font(fontBold).fontSize(8).text(h, x + 4, y + 1, { width: shiftCols[i] });
      x += shiftCols[i];
    });
    y += 20;

    data.shifts.forEach((shift, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.fillColor(rowBg).rect(50, y - 3, contentWidth, 18).fill();
      const cols = [
        shift.cashierName,
        shift.status === 'OPEN' ? 'Đang mở' : 'Đã đóng',
        formatDateTime(shift.openedAt),
        `${shift.orderCount}`,
        formatCurrency(shift.cashTotal),
        formatCurrency(shift.transferTotal),
      ];
      x = 50;
      cols.forEach((val, i) => {
        doc.fillColor('#374151').font(fontRegular).fontSize(8).text(val, x + 4, y + 1, { width: shiftCols[i] });
        x += shiftCols[i];
      });
      y += 20;
    });

    if (data.shifts.length === 0) {
      doc.fillColor('#9ca3af').font(fontRegular).fontSize(8).text('Không có ca làm việc nào trong kỳ.', 54, y);
      y += 20;
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 45;
    drawHorizontalRule(doc, footerY - 8);
    doc
      .fillColor('#9ca3af')
      .font(fontRegular)
      .fontSize(7)
      .text(
        `Tài liệu này được tạo tự động bởi hệ thống RestoFlow POS lúc ${formatDateTime(data.summary.generatedAt)}. Vui lòng không chỉnh sửa.`,
        50,
        footerY,
        { width: contentWidth, align: 'center' }
      );

    doc.end();
  });
}
