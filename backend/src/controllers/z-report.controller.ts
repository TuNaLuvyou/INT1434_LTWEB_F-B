import { Request, Response } from 'express';
import { z } from 'zod';
import * as zReportService from '../services/z-report.service';
import { generateZReportPDF } from '../services/pdf.service';
import { sendZReportEmail } from '../services/email.service';

// ─── Validation Schema ────────────────────────────────────────────────────────

const dateRangeSchema = z.object({
  from: z.string().datetime({ message: '"from" phải là chuỗi ngày ISO 8601 hợp lệ' }),
  to: z.string().datetime({ message: '"to" phải là chuỗi ngày ISO 8601 hợp lệ' }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate query params chứa khoảng thời gian và trả về { from, to }.
 * Ném lỗi 400 nếu dữ liệu không hợp lệ.
 */
function parseDateRange(req: Request, res: Response): { from: string; to: string } | null {
  try {
    const { from, to } = dateRangeSchema.parse(req.query);
    if (new Date(from) > new Date(to)) {
      res.status(400).json({ success: false, message: '"from" không thể lớn hơn "to"' });
      return null;
    }
    return { from, to };
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else {
      res.status(400).json({ success: false, message: 'Query params không hợp lệ' });
    }
    return null;
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/z-report/data?from=...&to=...
 * Trả về dữ liệu JSON Z-Report (để frontend render preview).
 * Yêu cầu quyền ADMIN hoặc MANAGER.
 */
export const getZReportData = async (req: Request, res: Response): Promise<void> => {
  const range = parseDateRange(req, res);
  if (!range) return;

  try {
    const data = await zReportService.getZReportData(range.from, range.to);
    
    // Ghi đè email người nhận bằng email của Admin/Manager đang đăng nhập
    const authenticatedUser = (req as any).user;
    if (authenticatedUser?.email) {
      data.summary.managerEmail = authenticatedUser.email;
    }

    res.json({ success: true, data });
  } catch (e: any) {
    console.error('[ZReportController] getZReportData error:', e);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu Z-Report' });
  }
};

/**
 * GET /api/z-report/download?from=...&to=...
 * Stream file PDF Z-Report trực tiếp về client để download.
 * Yêu cầu quyền ADMIN hoặc MANAGER.
 */
export const downloadZReportPDF = async (req: Request, res: Response): Promise<void> => {
  const range = parseDateRange(req, res);
  if (!range) return;

  try {
    const data = await zReportService.getZReportData(range.from, range.to);
    
    // Ghi đè email người nhận bằng email của Admin/Manager đang đăng nhập
    const authenticatedUser = (req as any).user;
    if (authenticatedUser?.email) {
      data.summary.managerEmail = authenticatedUser.email;
    }

    const pdfBuffer = await generateZReportPDF(data);

    const filename = `z-report-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    res.send(pdfBuffer);
  } catch (e: any) {
    console.error('[ZReportController] downloadZReportPDF error:', e);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo PDF Z-Report' });
  }
};

/**
 * POST /api/z-report/send-email
 * Body: { from: string (ISO), to: string (ISO) }
 * Tạo PDF và gửi tới email Manager (lấy từ SystemConfig hoặc env).
 * Yêu cầu quyền ADMIN hoặc MANAGER.
 */
export const sendZReportEmailHandler = async (req: Request, res: Response): Promise<void> => {
  // Đọc from/to từ body (POST request)
  const bodySchema = z.object({
    from: z.string().datetime({ message: '"from" phải là chuỗi ngày ISO 8601 hợp lệ' }),
    to: z.string().datetime({ message: '"to" phải là chuỗi ngày ISO 8601 hợp lệ' }),
  });

  let from: string;
  let to: string;

  try {
    const parsed = bodySchema.parse(req.body);
    from = parsed.from;
    to = parsed.to;

    if (new Date(from) > new Date(to)) {
      res.status(400).json({ success: false, message: '"from" không thể lớn hơn "to"' });
      return;
    }
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else {
      res.status(400).json({ success: false, message: 'Request body không hợp lệ' });
    }
    return;
  }

  try {
    // 1. Lấy dữ liệu Z-Report từ DB
    const data = await zReportService.getZReportData(from, to);

    // 2. Tạo PDF buffer
    const pdfBuffer = await generateZReportPDF(data);

    // 3. Gửi email (Ưu tiên gửi tới email của Admin/Manager đang đăng nhập thực hiện báo cáo, fallback là managerEmail cấu hình)
    const authenticatedUser = (req as any).user;
    const recipientEmail = authenticatedUser?.email ?? data.summary.managerEmail;

    const messageId = await sendZReportEmail({
      to: recipientEmail,
      restaurantName: data.summary.restaurantName,
      from: data.summary.from,
      to_date: data.summary.to,
      generatedAt: data.summary.generatedAt,
      totalRevenue: data.kpi.totalRevenue,
      totalOrders: data.kpi.totalOrders,
      totalDiscount: data.kpi.totalDiscount,
      pdfBuffer,
    });

    res.json({
      success: true,
      message: `Z-Report đã được gửi thành công tới ${recipientEmail}`,
      data: { messageId, sentTo: recipientEmail },
    });
  } catch (e: any) {
    console.error('[ZReportController] sendZReportEmailHandler error:', e);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi email Z-Report. Kiểm tra cấu hình SMTP.',
    });
  }
};
