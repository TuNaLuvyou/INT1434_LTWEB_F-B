/**
 * src/utils/mailer.ts
 *
 * Nodemailer transporter singleton + helper gửi email cảnh báo tồn kho thấp.
 *
 * Cấu hình qua biến môi trường (thêm vào .env):
 *   SMTP_HOST      smtp.gmail.com
 *   SMTP_PORT      587
 *   SMTP_USER      your-email@gmail.com
 *   SMTP_PASS      your-app-password        ← Gmail App Password (không dùng MK thường)
 *   ADMIN_EMAIL    admin@restoflow.demo      ← địa chỉ nhận cảnh báo
 *
 * Nếu các biến không được cấu hình → chỉ log ra console (graceful degradation),
 * không crash server.
 */

import nodemailer from 'nodemailer';

// ── Singleton transporter ──────────────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // Chưa cấu hình SMTP → email sẽ không được gửi
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // true cho port 465 (SSL), false cho 587 (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return _transporter;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LowStockItem {
  id:       string;
  name:     string;
  unit:     string;
  stock:    number;
  minStock: number;
}

// ── Email template ─────────────────────────────────────────────────────────────

function buildLowStockEmailHtml(items: LowStockItem[], trigger: string): string {
  const rows = items.map(ing => {
    const ratio     = ing.minStock > 0 ? (ing.stock / ing.minStock) * 100 : 0;
    const isZero    = ing.stock === 0;
    const rowColor  = isZero ? '#FEE2E2' : '#FFF7ED';
    const badgeColor = isZero ? '#DC2626' : '#D97706';
    const badgeText  = isZero ? 'HẾT HÀNG' : 'SẮP HẾT';

    return `
      <tr style="background:${rowColor}">
        <td style="padding:10px 16px;font-weight:600;color:#111">${ing.name}</td>
        <td style="padding:10px 16px;color:#555">${ing.unit}</td>
        <td style="padding:10px 16px;font-family:monospace;color:#111;font-weight:700">${ing.stock}</td>
        <td style="padding:10px 16px;font-family:monospace;color:#555">${ing.minStock}</td>
        <td style="padding:10px 16px;text-align:center">
          <span style="display:inline-block;padding:2px 10px;border-radius:9999px;
                       background:${badgeColor};color:#fff;font-size:11px;font-weight:700">
            ${badgeText}
          </span>
        </td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;
              box-shadow:0 4px 24px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#DC2626,#B91C1C);padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">
        ⚠️ Cảnh báo Tồn kho thấp
      </h1>
      <p style="margin:6px 0 0;color:#FCA5A5;font-size:14px">
        RestoFlow POS · ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
      </p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">
      <p style="color:#374151;font-size:15px;margin:0 0 20px">
        Xin chào Admin,<br><br>
        Hệ thống phát hiện <strong>${items.length} nguyên liệu</strong> đang ở mức tồn kho thấp
        sau sự kiện: <code style="background:#F3F4F6;padding:2px 6px;border-radius:4px">${trigger}</code>.
        Vui lòng nhập kho ngay để đảm bảo hoạt động nhà hàng không bị gián đoạn.
      </p>

      <!-- Table -->
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#F9FAFB;border-bottom:2px solid #E5E7EB">
            <th style="padding:10px 16px;text-align:left;color:#6B7280;text-transform:uppercase;font-size:11px;font-weight:600">Nguyên liệu</th>
            <th style="padding:10px 16px;text-align:left;color:#6B7280;text-transform:uppercase;font-size:11px;font-weight:600">Đơn vị</th>
            <th style="padding:10px 16px;text-align:left;color:#6B7280;text-transform:uppercase;font-size:11px;font-weight:600">Tồn kho</th>
            <th style="padding:10px 16px;text-align:left;color:#6B7280;text-transform:uppercase;font-size:11px;font-weight:600">Ngưỡng</th>
            <th style="padding:10px 16px;text-align:center;color:#6B7280;text-transform:uppercase;font-size:11px;font-weight:600">Trạng thái</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <!-- CTA -->
      <div style="margin-top:24px;padding:16px;background:#FFF7ED;border-left:4px solid #F59E0B;border-radius:4px">
        <p style="margin:0;color:#92400E;font-size:14px">
          💡 Đăng nhập vào <strong>RestoFlow Dashboard → Quản lý kho</strong>
          để nhập hàng hoặc điều chỉnh tồn kho ngay.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center">
      <p style="margin:0;color:#9CA3AF;font-size:12px">
        Email này được gửi tự động từ hệ thống RestoFlow POS.<br>
        Vui lòng không trả lời trực tiếp email này.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Gửi email cảnh báo tồn kho thấp tới admin.
 *
 * - Nếu SMTP chưa cấu hình → chỉ log ra console, không throw error.
 * - Nếu gửi fail (network, auth lỗi...) → log warning, không crash server.
 *   (Fire-and-forget pattern — không block luồng nghiệp vụ chính)
 *
 * @param items   Danh sách ingredient đang ở mức thấp
 * @param trigger Mô tả sự kiện kích hoạt (vd: 'ORDER_DEDUCT', 'WASTE:EXPIRED')
 */
export async function sendLowStockAlert(
  items: LowStockItem[],
  trigger: string
): Promise<void> {
  if (items.length === 0) return;

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('[Mailer] ADMIN_EMAIL chưa được cấu hình — bỏ qua gửi email.');
    // Fallback: log ra console để dev có thể thấy
    console.warn('[LOW-STOCK]', items.map(i => `${i.name}: ${i.stock}/${i.minStock} ${i.unit}`).join(', '));
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[Mailer] SMTP chưa cấu hình — bỏ qua gửi email.');
    console.warn('[LOW-STOCK]', items.map(i => `${i.name}: ${i.stock}/${i.minStock} ${i.unit}`).join(', '));
    return;
  }

  const subject = `⚠️ [RestoFlow] ${items.length} nguyên liệu sắp hết kho`;
  const html    = buildLowStockEmailHtml(items, trigger);

  try {
    const info = await transporter.sendMail({
      from:    `"RestoFlow POS" <${process.env.SMTP_USER}>`,
      to:      adminEmail,
      subject,
      html,
    });
    console.log(`[Mailer] ✅ Đã gửi cảnh báo low-stock → ${adminEmail} (msgId: ${info.messageId})`);
  } catch (err) {
    // Không throw — chỉ log để tránh fail luồng thanh toán vì email lỗi
    console.error('[Mailer] ❌ Gửi email thất bại:', err);
  }
}
