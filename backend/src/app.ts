import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import menuRoutes from './routes/menu.routes';
import adminMenuRoutes from './routes/admin.menu.routes';

const app = express();
const PORT = process.env.PORT || 5000; // Cổng chạy mặc định là 5000 hoặc PORT từ .env

// Middlewares
app.use(cors());
app.use(express.json());

// Đăng ký route GET /api/menu
app.use('/api/menu', menuRoutes);

// Đăng ký route quản lý admin
app.use('/api/admin/menu-items', adminMenuRoutes);
// Route mặc định kiểm tra server
app.get('/', (req, res) => {
  res.json({ success: true, message: 'RestoFlow POS Backend API is running!' });
});

// Khởi chạy server
app.listen(PORT, () => {
  console.log(`🚀 Server RestoFlow đang chạy tại: http://localhost:${PORT}`);
});

export default app;
