# 🍽️ HiAI-MenuGo POS — Hệ thống Quản lý Nhà hàng Thông minh

**HiAI-MenuGo POS** là hệ thống SaaS quản lý nhà hàng toàn diện, hỗ trợ đặt món tại bàn qua QR code, quản trị POS tại quầy, hiển thị bếp (KDS), và quản lý vận hành theo thời gian thực.

---

## 🧱 Kiến trúc

```
INT1434_LTWEB_F-B/
├── backend/          # Express + TypeScript + Prisma + PostgreSQL + Socket.IO
│   ├── src/
│   │   ├── controllers/   # Xử lý request
│   │   ├── services/      # Business logic
│   │   ├── middlewares/    # Auth, upload, feature guard
│   │   ├── routes/        # Định tuyến API
│   │   ├── socket/        # Socket.IO events & rooms
│   │   ├── config/        # Cấu hình (env, cloudinary, cors,...)
│   │   ├── types/         # Type definitions
│   │   └── utils/         # Helpers
│   └── prisma/
│       └── schema.prisma  # Schema DB chính thức (627 dòng)
└── frontend/         # Next.js 16 + React 19 + Tailwind CSS 4
    ├── app/              # App Router pages
    │   ├── table/         # QR Menu (public)
    │   ├── pos/           # Cashier / POS
    │   ├── kds/           # Kitchen Display System
    │   ├── admin/         # Dashboard, menu, inventory, vouchers, reports
    │   ├── login/         # Đăng nhập
    │   ├── branch-select/ # Chọn chi nhánh
    │   └── platform-admin/ # Quản trị SaaS
    ├── components/       # UI components
    ├── hooks/            # useSocket, useCartSync, useAutoRefresh
    └── stores/           # Zustand (auth, cart)
```

---

## ✨ Tính năng chính

### 👤 Khách hàng (Public QR Menu)
- Gọi món tại bàn qua QR code — không cần đăng nhập
- Giỏ hàng realtime (Socket.IO)
- Chống đặt hàng từ xa bằng **Geofencing** (thuật toán Haversine)

### 👨‍🍳 Nhà bếp (KDS)
- Tiếp nhận & cập nhật trạng thái món (Preparing → Done → Delivered → Void)
- Cập nhật tức thời qua Socket.IO

### 💵 Thu ngân (POS)
- Sơ đồ bàn trực quan, mở/đóng phiên
- Duyệt đơn, thanh toán tiền mặt (CASH) & chuyển khoản (VietQR)
- Void món + hoàn kho tự động

### 📊 Quản trị (Admin)
- Quản lý danh mục, món ăn (upload ảnh Cloudinary)
- Voucher / khuyến mãi (theo chi nhánh)
- Kho hàng & BOM: tự động trừ NVL khi bán, cảnh báo tồn thấp
- Z-Report: báo cáo cuối ca, gửi email tự động
- Phân quyền động (RBAC)
- Dashboard doanh thu, biểu đồ, top selling

### ☁️ Nền tảng (SaaS Core)
- Multi-tenant & Multi-branch
- Quản lý gói dịch vụ (Starter/Professional/Enterprise)
- Giới hạn tài nguyên theo gói (bàn, user, chi nhánh, món ăn)

---

## 🛠️ Công nghệ

| Layer          | Công nghệ                                                                 |
|----------------|---------------------------------------------------------------------------|
| **Frontend**   | Next.js 16, React 19, Tailwind CSS 4, Zustand, Recharts, Socket.IO Client |
| **Backend**    | Node.js, Express 5, TypeScript, Prisma ORM, Socket.IO, JWT, Nodemailer    |
| **Database**   | PostgreSQL (Supabase), pg                                                  |
| **Storage**    | Cloudinary (ảnh món ăn)                                                   |
| **Realtime**   | Socket.IO (rooms theo tenant:branch)                                      |

---

## 🚀 Cài đặt & chạy

### Yêu cầu
- Node.js ≥ 18
- PostgreSQL ≥ 14 (khuyến nghị Supabase)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # điền thông số kết nối
npx prisma db push
npx prisma generate
npm run db:seed
npm run dev            # mặc định cổng 5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # NEXT_PUBLIC_API_URL -> http://127.0.0.1:5000
npx prisma generate
npm run dev            # mặc định cổng 3000
```

---

## 🔑 Tài khoản mặc định

Mật khẩu chung: **`Demo@1234`**

| Vai trò   | Email                        | Quyền hạn                          |
|-----------|------------------------------|-------------------------------------|
| ADMIN     | admin@hiaimenugo.demo        | Toàn quyền                          |
| MANAGER   | manager@hiaimenugo.demo      | Món ăn, kho, voucher                |
| CASHIER   | cashier@hiaimenugo.demo      | POS, duyệt đơn, thanh toán          |
| KITCHEN   | kitchen@hiaimenugo.demo      | KDS (màn hình bếp)                  |

---

## 📡 Realtime Events (Socket.IO)

Hệ thống sử dụng Socket.IO với 14 event types, phân luồng theo `tenantId:branchId`:

- `order:new` / `order:updated` / `order:voided`
- `cart:updated`
- `table:updated` / `session:updated`
- `payment:completed`
- `inventory:updated`
- `sold-out:toggled`

---

## 🧪 Thử nghiệm Geofencing

1. Đăng nhập ADMIN → **Cài đặt hệ thống** → tab **Định vị**
2. Bật giới hạn, nhập tọa độ & bán kính
3. Vào `http://localhost:3000/table/1`
4. Dùng DevTools (Sensors) giả lập GPS

---

## 📝 Git Workflow

- **`main`**: Production
- **`feature/*`**, **`hotfix/*`**: Phát triển & sửa lỗi
- Commit convention: `feat:`, `fix:`, `docs:`, `refactor:`, ...

---

## 👨‍💻 Thông tin

Phát triển bởi **Trần Hoàng Đạt** & **Phạm Văn Đoàn** — Học Viện Công Nghệ Bưu Chính Viễn Thông - HCM (PTITHCM).
