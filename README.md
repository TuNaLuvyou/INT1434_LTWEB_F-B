# 🍽️ RestoFlow POS — Hệ thống Quản lý Nhà hàng Thông minh

> **Môn học:** INT1434 — Lập trình Web  
> **Lớp:** D23CQCN01-N  
> **Trường:** Học viện Công nghệ Bưu chính Viễn thông (PTIT)

---

## 👥 Thành viên nhóm

| STT | Họ và tên | MSSV | Vai trò |
|-----|-----------|------|---------|
| 1 | **Trần Hoàng Đạt** | N23DCCN009 | Nhóm trưởng |
| 2 | **Phạm Văn Đoàn** | N23DCCN010 | Thành viên |

---

## 📋 Tổng quan dự án

**RestoFlow POS** là hệ thống phần mềm quản lý nhà hàng toàn diện, được xây dựng theo kiến trúc **Full-Stack** với giao tiếp **Real-time**. Hệ thống hỗ trợ toàn bộ vòng đời hoạt động của nhà hàng — từ quản lý thực đơn, đặt bàn, xử lý đơn hàng tại bếp, thu ngân đến phân tích doanh thu và quản lý nhân sự.

---

## 🛠️ Công nghệ sử dụng chính

- **Backend:** Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL, Socket.IO, JWT.
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Zustand, Recharts.

---

## 🚀 Hướng dẫn cài đặt & chạy dự án

### Yêu cầu hệ thống
- **Node.js** ≥ 18.x
- **PostgreSQL** ≥ 14

### 1. Clone repository

```bash
git clone https://github.com/TuNaLuvyou/INT1434_LTWEB_F-B.git
cd INT1434_LTWEB_F-B
```

### 2. Cấu hình & Chạy Backend

```bash
cd backend
npm install
```

Tạo file `.env` trong thư mục `backend/`:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/restoflow_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-at-least-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=5000
NODE_ENV=development

# Cloudinary (upload ảnh món ăn)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Frontend URL (cho CORS)
FRONTEND_URL="http://localhost:3000"
```

Khởi tạo database và seed dữ liệu mẫu:

```bash
# Tạo bảng trong database
npx prisma migrate dev --name init

# Seed dữ liệu mẫu (admin, menu, tables...)
npm run db:seed
```

Khởi động Backend:

```bash
npm run dev
# Backend chạy tại: http://localhost:5000
```

### 3. Cấu hình & Chạy Frontend

Mở một terminal mới:

```bash
cd frontend
npm install
```

Tạo file `.env.local` trong thư mục `frontend/`:

```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_WS_URL="http://localhost:5000"
JWT_SECRET="your-super-secret-jwt-key-at-least-32-chars"
```

Khởi động Frontend:

```bash
npm run dev
# Frontend chạy tại: http://localhost:3000
```

---

## 🔑 Tài khoản mặc định (sau khi seed)

| Role | Email | Mật khẩu |
|------|-------|---------|
| ADMIN | `admin@restoflow.demo` | `Admin@123` |
| MANAGER | `manager@restoflow.demo` | `Manager@123` |
| CASHIER | `cashier@restoflow.demo` | `Cashier@123` |
| KITCHEN | `kitchen@restoflow.demo` | `Kitchen@123` |
| STAFF | `staff@restoflow.demo` | `Staff@123` |

---

## 📝 Git Workflow & Commit Convention

- **Nhánh chính:** `main` (Production), `dev` (Integration branch).
- **Phát triển tính năng:** Tạo nhánh `feature/*` hoặc `hotfix/*` từ `dev`.
- **Cấu trúc Commit:** `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`

---

<div align="center">
  <strong>RestoFlow POS</strong> — Built with ❤️ by D23CQCN01-N Team<br/>
  Trần Hoàng Đạt (N23DCCN009) · Phạm Văn Đoàn (N23DCCN010)
</div>
