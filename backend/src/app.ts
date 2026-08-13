import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import adminMenuRoutes from './routes/admin.menu.routes';
import adminCategoryRoutes from './routes/admin.category.routes';
import adminUserRoutes from './routes/admin.user.routes';
import systemRoutes from './routes/system.routes';
import soldOutRoutes from './routes/sold-out.routes';
import tableRoutes from './routes/table.routes';
import sessionRoutes from './routes/session.routes';
import ingredientRoutes, { reverseRouter } from './routes/ingredient.routes';

import kdsRoutes from './routes/kds.routes';
import cashierRoutes from './routes/cashier.routes';
import analyticsRoutes from './routes/analytics.routes';
import paymentRoutes from './routes/payment.routes';
import voucherRoutes from './routes/voucher.routes';
import zReportRoutes from './routes/z-report.routes';
import platformAdminRoutes from './routes/platform-admin.routes';
import { initSocket } from './socket';
import { globalErrorHandler } from './middlewares/error.middleware';
import { startAutomaticCleanupJob } from './services/cleanup.service';
import { authMiddleware, requireRole } from './middlewares/auth.middleware';
import { syncMenu } from './controllers/system.controller';
import { ApiResponse } from './utils/response';

import bankRoutes from './routes/bank.routes';
import branchRoutes from './routes/branch.routes';
import customerRoutes from './routes/customer.routes';
import membershipTierRoutes from './routes/membershipTier.routes';
import sepayRoutes from './routes/sepay.routes';
import brandingRoutes from './routes/branding.routes';
import apiKeyRoutes from './routes/apiKey.routes';
import webhookRoutes from './routes/webhook.routes';
import v1Router from './routes/v1';
import { startWebhookWorker } from './workers/webhook.worker';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 5000;

// HTTP Request Logger Middleware — log qua logger.ts (đã format timestamp)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method.padEnd(6, ' ');
    logger.info('HTTP', `${method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Open API v1 dành cho đối tác bên thứ 3 (Xác thực bằng Header: x-api-key)
app.use('/api/v1', v1Router);

// Đăng ký routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/inventory', reverseRouter);   // POST /reverse — phân quyền CASHIER
app.use('/api/inventory', ingredientRoutes); // /logs alias — phân quyền ADMIN/MANAGER

app.use('/api/kds', kdsRoutes);
app.use('/api/cashier', cashierRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/z-report', zReportRoutes);
app.use('/api/webhooks/sepay', sepayRoutes);

// Đăng ký route sold-out TRƯỚC để nó bắt lấy request PATCH /:id/sold-out
// và xử lý quyền hạn cho cả KITCHEN, tránh bị chặn bởi adminMenuRoutes ở dưới.
app.use('/api/admin/menu-items', soldOutRoutes);

// Đăng ký route quản lý admin (yêu cầu ADMIN/MANAGER cho các thao tác CRUD)
app.use('/api/admin/menu-items', adminMenuRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/users', adminUserRoutes);

// System routes
app.use('/api/system', systemRoutes);
app.use('/api/platform-admin', platformAdminRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/membership-tiers', membershipTierRoutes);
app.use('/api/branding', brandingRoutes);

// API Key & Webhook routes
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/webhooks', webhookRoutes);

// Admin sync menu
app.post('/api/admin/menu/sync', authMiddleware, requireRole(['ADMIN', 'MANAGER']), syncMenu as any);

// Route kiểm tra server (Health Check)
app.get('/api/health', (req, res) => {
  return ApiResponse.success(res, { timestamp: new Date().toISOString() }, 'HiAI-MenuGo POS Backend API is running!');
});

// Error handling middleware
app.use(globalErrorHandler);

// ─── QUAN TRỌNG: Tạo HTTP server thủ công để Socket.io có thể attach vào ───
// Nếu dùng app.listen() trực tiếp thì Socket.io không thể share cùng port.
// Thay vào đó: http.createServer(app) -> server.listen(PORT)
// Socket.io attach vào cùng http server -> cùng port, không cần mở thêm port mới.
const httpServer = http.createServer(app);

// Khởi tạo Socket.io SAU KHI tạo httpServer
initSocket(httpServer);

// Khởi chạy server qua httpServer thay vì app.listen
httpServer.listen(PORT, () => {
  logger.info('Server', `HiAI-MenuGo API listening at http://localhost:${PORT}`);
  logger.info('Socket.io', `Socket.io ready on the same port ${PORT}`);

  // Khởi động tác vụ tự động dọn dẹp lịch sử bán hàng (> 90 ngày)
  startAutomaticCleanupJob();

  // Khởi động Webhook Worker (BullMQ)
  if (process.env.REDIS_URL) {
    startWebhookWorker();
  } else {
    logger.warn('App', 'REDIS_URL not set — webhook worker not started');
  }
});

export default app;
