import nodemailer from 'nodemailer';

// ─── Transporter singleton ────────────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null;

/**
 * Tạo hoặc tái sử dụng Nodemailer transporter SMTP.
 * Cấu hình được đọc từ biến môi trường SMTP_*.
 */
function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // STARTTLS (port 587)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/** Format số tiền sang chuỗi VND */
function fmt(value: number): string {
  return value.toLocaleString('vi-VN') + ' VND';
}

/** Format ISO date string thành dd/MM/yyyy HH:mm */
function fmtDate(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ZReportEmailParams {
  to: string;
  restaurantName: string;
  from: string;
  to_date: string;
  generatedAt: string;
  totalRevenue: number;
  totalOrders: number;
  totalDiscount: number;
  pdfBuffer: Buffer;
}

/**
 * Gửi email Z-Report có đính kèm file PDF tới địa chỉ Manager.
 *
 * @param params - Thông tin email và dữ liệu để render HTML body
 * @returns Promise<string> - Message ID của email đã gửi
 */
export async function sendZReportEmail(params: ZReportEmailParams): Promise<string> {
  const {
    to,
    restaurantName,
    from,
    to_date,
    generatedAt,
    totalRevenue,
    totalOrders,
    totalDiscount,
    pdfBuffer,
  } = params;

  const subject = `[RestoFlow] Z-Report – ${restaurantName} – ${fmtDate(from)} đến ${fmtDate(to_date)}`;

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, sans-serif; }
    .wrapper { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); padding: 32px 40px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0; color: #93c5fd; font-size: 13px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.15); color: #bfdbfe; border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 600; margin-top: 12px; letter-spacing: 1px; }
    .body { padding: 32px 40px; }
    .greeting { color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .kpi-grid { display: flex; gap: 12px; margin-bottom: 28px; }
    .kpi-card { flex: 1; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; text-align: center; }
    .kpi-card .label { font-size: 11px; color: #6b7280; margin-bottom: 6px; }
    .kpi-card .value { font-size: 16px; font-weight: 700; }
    .kpi-revenue .value { color: #16a34a; }
    .kpi-orders .value { color: #2563eb; }
    .kpi-discount .value { color: #dc2626; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-row .key { color: #6b7280; }
    .info-row .val { color: #111827; font-weight: 600; }
    .attachment-note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 13px; color: #1d4ed8; display: flex; align-items: center; gap: 10px; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; text-align: center; }
    .footer p { margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${restaurantName}</h1>
      <p>Báo cáo tổng kết ca được gửi tự động bởi hệ thống RestoFlow POS</p>
      <div class="badge">Z-REPORT</div>
    </div>
    <div class="body">
      <p class="greeting">
        Kính gửi Quản lý,<br /><br />
        Hệ thống RestoFlow POS đã tổng hợp xong báo cáo Z-Report cho kỳ hoạt động.
        Vui lòng xem file đính kèm để biết chi tiết đầy đủ.
      </p>

      <div class="kpi-grid">
        <div class="kpi-card kpi-revenue">
          <div class="label">Tổng Doanh Thu</div>
          <div class="value">${fmt(totalRevenue)}</div>
        </div>
        <div class="kpi-card kpi-orders">
          <div class="label">Số Đơn</div>
          <div class="value">${totalOrders}</div>
        </div>
        <div class="kpi-card kpi-discount">
          <div class="label">Tổng Giảm Giá</div>
          <div class="value">${fmt(totalDiscount)}</div>
        </div>
      </div>

      <div class="info-box">
        <div class="info-row"><span class="key">Nhà hàng</span><span class="val">${restaurantName}</span></div>
        <div class="info-row"><span class="key">Từ</span><span class="val">${fmtDate(from)}</span></div>
        <div class="info-row"><span class="key">Đến</span><span class="val">${fmtDate(to_date)}</span></div>
        <div class="info-row"><span class="key">Xuất báo cáo lúc</span><span class="val">${fmtDate(generatedAt)}</span></div>
      </div>

      <div class="attachment-note">
        📎 File PDF Z-Report chi tiết đã được đính kèm vào email này.
      </div>
    </div>
    <div class="footer">
      <p>Email này được gửi tự động bởi hệ thống <strong>RestoFlow POS</strong>.<br />Vui lòng không trả lời email này.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"RestoFlow POS" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename: `z-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return info.messageId as string;
}
