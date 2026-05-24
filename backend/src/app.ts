import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import adminMenuRoutes from './routes/admin.menu.routes';
import soldOutRoutes from './routes/sold-out.routes';
import tableRoutes from './routes/table.routes';
import sessionRoutes from './routes/session.routes';
import ingredientRoutes from './routes/ingredient.routes';
import { initSocket } from './socket';

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Đăng ký routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/inventory', ingredientRoutes); // alias for /logs sub-route

// Đăng ký route sold-out TRƯỚC để nó bắt lấy request PATCH /:id/sold-out
// và xử lý quyền hạn cho cả KITCHEN, tránh bị chặn bởi adminMenuRoutes ở dưới.
app.use('/api/admin/menu-items', soldOutRoutes);

// Đăng ký route quản lý admin (yêu cầu ADMIN/MANAGER cho các thao tác CRUD)
app.use('/api/admin/menu-items', adminMenuRoutes);

// Route kiểm tra server
app.get('/', (req, res) => {
  res.json({ success: true, message: 'RestoFlow POS Backend API is running!' });
});

// ─── QUAN TRỌNG: Tạo HTTP server thủ công để Socket.io có thể attach vào ───
// Nếu dùng app.listen() trực tiếp thì Socket.io không thể share cùng port.
// Thay vào đó: http.createServer(app) -> server.listen(PORT)
// Socket.io attach vào cùng http server -> cùng port, không cần mở thêm port mới.
const httpServer = http.createServer(app);

// Khởi tạo Socket.io SAU KHI tạo httpServer
initSocket(httpServer);

// Khởi chạy server qua httpServer thay vì app.listen
httpServer.listen(PORT, () => {
  console.log(`🚀 Server RestoFlow đang chạy tại: http://localhost:${PORT}`);
  console.log(`🔌 Socket.io sẵn sàng trên cùng port ${PORT}`);
});

export default app;
