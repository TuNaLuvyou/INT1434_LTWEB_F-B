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

### 🎯 Mục tiêu
- Số hóa quy trình vận hành nhà hàng, giảm sai sót thủ công
- Cung cấp giao diện chuyên biệt cho từng vị trí (Admin, Manager, Cashier, Kitchen Staff)
- Cập nhật trạng thái đơn hàng **real-time** qua WebSocket
- Xuất báo cáo doanh thu chi tiết dưới dạng Excel

---

## 🛠️ Công nghệ sử dụng

### Backend
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|---------|
| **Node.js** | ≥ 18.x | Runtime |
| **Express.js** | ^5.2.1 | REST API Framework |
| **TypeScript** | ^6.0.3 | Type safety |
| **Prisma ORM** | ^7.8.0 | Database ORM |
| **PostgreSQL** | ≥ 14 | Cơ sở dữ liệu chính |
| **Socket.IO** | ^4.8.3 | Real-time WebSocket |
| **JWT (jsonwebtoken)** | ^9.0.3 | Xác thực & phân quyền |
| **Bcrypt** | ^5.1.1 | Mã hóa mật khẩu |
| **Zod** | ^4.4.3 | Validation schema |
| **ExcelJS** | ^4.4.0 | Xuất báo cáo Excel |
| **PDFKit** | ^0.18.0 | Xuất báo cáo PDF |
| **Cloudinary** | ^1.41.3 | Lưu trữ hình ảnh |
| **Nodemailer** | ^8.0.9 | Gửi email thông báo |
| **express-rate-limit** | ^8.5.2 | Bảo vệ chống Brute Force |

### Frontend
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|---------|
| **Next.js** | 16.2.6 | React Framework (App Router) |
| **React** | 19.2.4 | UI Library |
| **TypeScript** | ^5 | Type safety |
| **Tailwind CSS** | ^4 | Utility-first CSS |
| **Zustand** | ^5.0.13 | Global State Management |
| **React Hook Form** | ^7.76.0 | Form management |
| **Zod** | ^4.4.3 | Form validation |
| **Recharts** | ^3.8.1 | Biểu đồ thống kê |
| **Socket.IO Client** | ^4.8.3 | Real-time connection |
| **JOSE** | ^6.2.3 | JWT xử lý middleware |
| **Lucide React** | ^1.16.0 | Icon library |
| **React Hot Toast** | ^2.6.0 | Notification |
| **QRCode React** | ^4.2.0 | Tạo QR code bàn ăn |
| **jsPDF** | ^4.2.1 | Xuất PDF client-side |
| **date-fns** | ^4.3.0 | Xử lý ngày tháng |

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  Next.js 16 App Router  │  ISR + SSR + CSR  │  Tailwind CSS     │
└────────────────────────────────┬────────────────────────────────┘
                                 │  HTTP REST / WebSocket
┌────────────────────────────────▼────────────────────────────────┐
│                        API LAYER                                  │
│  Express.js v5  │  JWT Auth  │  RBAC Middleware  │  Rate Limit   │
│  Zod Validation  │  Socket.IO  │  Error Middleware                │
└────────────────────────────────┬────────────────────────────────┘
                                 │  Prisma ORM
┌────────────────────────────────▼────────────────────────────────┐
│                       DATA LAYER                                  │
│  PostgreSQL  │  Cloudinary (Images)  │  Nodemailer (Email)        │
└─────────────────────────────────────────────────────────────────┘
```

### Chiến lược Render (Next.js)
| Trang | Chiến lược | Lý do |
|-------|-----------|-------|
| `/admin/dashboard` | **ISR** (revalidate: 60s) | Dữ liệu analytics không cần real-time tức thì |
| `/pos`, `/cashier` | **CSR** | Real-time Socket.IO |
| `/kds` | **CSR** | Cập nhật đơn bếp real-time |
| `/admin/settings` | **SSR** | Dữ liệu nhạy cảm, cần server auth |
| `/table/:qr` | **ISR** | Menu ít thay đổi |

---

## 🗄️ Mô hình dữ liệu

### Các Model chính

```
User ──────────────── TrustedDevice
 │                         │
 ├── Shift ─────────── Payment ── Voucher
 │      └── ZReport
 ├── Attendance ─── WorkSchedule
 │
Table ─── TableSession ─── OrderItem ─── MenuItem ─── Category
                │                              │
                └── Payment              Ingredient (via MenuIngredient)
                                               │
                                         IngredientLog
```

### Phân quyền (RBAC)

| Role | Quyền hạn |
|------|----------|
| `ADMIN` | Toàn quyền hệ thống, quản lý users, cấu hình, vouchers |
| `MANAGER` | Dashboard analytics, quản lý thực đơn, ca làm, xuất báo cáo |
| `CASHIER` | Xử lý thanh toán, xem ca làm việc, Z-Report |
| `STAFF` | Quản lý đơn hàng tại bàn (POS) |
| `KITCHEN` | Xem và cập nhật trạng thái món ăn (KDS) |

---

## 📁 Cấu trúc dự án

```
INT1434_LTWEB_F-B/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Dữ liệu mẫu
│   └── src/
│       ├── app.ts                 # Entry point Express
│       ├── config/
│       │   ├── prisma.ts          # Prisma client
│       │   └── socket.ts          # Socket.IO setup
│       ├── controllers/           # Request handlers
│       │   ├── analytics.controller.ts
│       │   ├── admin.user.controller.ts
│       │   ├── cashier.controller.ts
│       │   ├── kds.controller.ts
│       │   ├── menu.controller.ts
│       │   ├── system.controller.ts
│       │   ├── voucher.controller.ts
│       │   └── ...
│       ├── middlewares/
│       │   ├── auth.middleware.ts  # JWT verify + requireRole()
│       │   └── error.middleware.ts # Global error handler
│       ├── routes/                # API routes (18 files)
│       ├── services/              # Business logic
│       │   ├── analytics.service.ts
│       │   ├── excel.service.ts   # ExcelJS export
│       │   └── cleanup.service.ts
│       └── utils/
│           └── app-error.ts
│
└── frontend/
    ├── app/
    │   ├── admin/
    │   │   ├── dashboard/         # ISR Analytics Dashboard
    │   │   ├── settings/          # Quản lý hệ thống (ADMIN only)
    │   │   ├── z-report/          # Báo cáo ca làm
    │   │   └── roles/             # Phân quyền
    │   ├── cashier/               # Giao diện thu ngân
    │   ├── kds/                   # Kitchen Display System
    │   ├── pos/                   # Point of Sale
    │   ├── attendance/            # Chấm công
    │   ├── table/                 # Menu QR bàn ăn
    │   └── login/
    ├── components/
    │   ├── auth/
    │   │   ├── RoleGate.tsx       # Ẩn/hiện UI theo role
    │   │   └── withRole.tsx       # HOC RBAC
    │   └── admin/settings/        # AccountModal, VoucherModal, ...
    ├── hooks/
    │   └── useRole.ts
    ├── lib/
    │   └── auth/getCurrentUser.ts # Server Component auth helper
    ├── middleware.ts               # Next.js edge middleware (JWT + RBAC)
    └── stores/
        └── auth.store.ts          # Zustand auth store
```

---

## ⚡ API Endpoints

### Authentication
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| POST | `/api/auth/login` | Public | Đăng nhập, nhận JWT |
| POST | `/api/auth/logout` | Auth | Đăng xuất |
| GET | `/api/auth/me` | Auth | Thông tin người dùng hiện tại |
| POST | `/api/auth/refresh` | Public | Làm mới Access Token |

### Quản lý thực đơn
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| GET | `/api/menu` | Public | Lấy toàn bộ thực đơn |
| GET | `/api/menu/:id` | Public | Chi tiết món ăn |
| POST | `/api/admin/menu-items` | ADMIN, MANAGER | Tạo món ăn |
| PUT | `/api/admin/menu-items/:id` | ADMIN, MANAGER | Sửa món ăn |
| DELETE | `/api/admin/menu-items/:id` | ADMIN | Xóa món ăn |

### Bàn & Phiên đặt bàn
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| GET | `/api/tables` | Auth | Danh sách bàn |
| POST | `/api/tables` | ADMIN | Tạo bàn |
| POST | `/api/sessions/join` | Public (QR) | Khách mở session bàn |
| PATCH | `/api/sessions/:id` | Auth | Cập nhật session |

### Thu ngân & Thanh toán
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| POST | `/api/cashier/payment` | CASHIER, ADMIN, MANAGER | Xử lý thanh toán |
| GET | `/api/cashier/shift` | CASHIER, ADMIN, MANAGER | Ca làm hiện tại |
| POST | `/api/cashier/shift/open` | CASHIER, ADMIN, MANAGER | Mở ca |
| POST | `/api/cashier/shift/close` | CASHIER, ADMIN, MANAGER | Đóng ca |

### Analytics & Báo cáo
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| GET | `/api/analytics/revenue` | ADMIN, MANAGER | Doanh thu theo ngày/tuần/tháng |
| GET | `/api/analytics/peak-hours` | ADMIN, MANAGER | Giờ cao điểm (Heatmap) |
| GET | `/api/analytics/top-selling` | ADMIN, MANAGER | Top món bán chạy |
| GET | `/api/analytics/export` | ADMIN, MANAGER | Xuất báo cáo Excel (4 sheets) |

### Quản lý hệ thống (ADMIN only)
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| GET | `/api/admin/users` | ADMIN | Danh sách người dùng |
| POST | `/api/admin/users` | ADMIN | Tạo tài khoản |
| PATCH | `/api/admin/users/:id` | ADMIN | Sửa thông tin |
| POST | `/api/admin/users/:id/reset-password` | ADMIN | Đặt lại mật khẩu |
| DELETE | `/api/admin/users/:id` | ADMIN | Vô hiệu hóa tài khoản |
| GET | `/api/system/config` | ADMIN | Cấu hình hệ thống |
| PUT | `/api/system/config` | ADMIN | Cập nhật cấu hình |
| GET | `/api/vouchers` | ADMIN, MANAGER, CASHIER | Danh sách voucher |
| POST | `/api/vouchers` | ADMIN | Tạo voucher |
| PUT | `/api/vouchers/:id` | ADMIN | Sửa voucher |
| DELETE | `/api/vouchers/:id` | ADMIN | Xóa/vô hiệu hóa voucher |
| POST | `/api/vouchers/validate` | Auth | Kiểm tra & tính giảm giá |

### KDS (Kitchen Display System)
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| GET | `/api/kds/orders` | KITCHEN, ADMIN, MANAGER | Đơn hàng đang xử lý |
| PATCH | `/api/kds/orders/:id` | KITCHEN, ADMIN, MANAGER | Cập nhật trạng thái món |

### Nhân sự & Chấm công
| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| POST | `/api/attendance/check-in` | Auth | Chấm công vào |
| POST | `/api/attendance/check-out` | Auth | Chấm công ra |
| GET | `/api/attendance` | ADMIN, MANAGER | Lịch sử chấm công |
| GET | `/api/schedule` | Auth | Lịch làm việc |

---

## 🚀 Hướng dẫn cài đặt & chạy dự án

### Yêu cầu hệ thống
- **Node.js** ≥ 18.x
- **PostgreSQL** ≥ 14
- **npm** ≥ 9.x

### 1. Clone repository

```bash
git clone https://github.com/TuNaLuvyou/INT1434_LTWEB_F-B.git
cd INT1434_LTWEB_F-B
```

### 2. Cấu hình Backend

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

# Nodemailer (gửi email thông báo)
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_USER="your-email@gmail.com"
MAIL_PASS="your-app-password"

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

Chạy backend:

```bash
npm run dev
```

> Backend khởi động tại: **http://localhost:5000**

### 3. Cấu hình Frontend

```bash
cd ../frontend
npm install
```

Tạo file `.env.local` trong thư mục `frontend/`:

```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_WS_URL="http://localhost:5000"
JWT_SECRET="your-super-secret-jwt-key-at-least-32-chars"
```

Chạy frontend:

```bash
npm run dev
```

> Frontend khởi động tại: **http://localhost:3000**

### 4. Tài khoản mặc định (sau khi seed)

| Role | Email | Mật khẩu |
|------|-------|---------|
| ADMIN | `admin@restoflow.com` | `Admin@123` |
| MANAGER | `manager@restoflow.com` | `Manager@123` |
| CASHIER | `cashier@restoflow.com` | `Cashier@123` |
| KITCHEN | `kitchen@restoflow.com` | `Kitchen@123` |
| STAFF | `staff@restoflow.com` | `Staff@123` |

---

## 🖥️ Giao diện hệ thống

### 1. Dashboard Analytics (`/admin/dashboard`)
- Biểu đồ doanh thu theo ngày/tuần/tháng (**Recharts BarChart**)
- Lưu lượng đơn hàng (**LineChart**)
- Heatmap giờ cao điểm (**ScatterChart**)
- Top 5 món bán chạy
- Xuất báo cáo Excel 4 sheets (Tổng quan, Chi tiết đơn, Top món, Báo cáo ca)
- Chiến lược **ISR revalidate: 60s**

### 2. POS (Point of Sale) (`/pos`)
- Giao diện đặt món cho khách hàng
- Hiển thị thực đơn real-time
- Thêm/xóa/sửa món trong giỏ hàng

### 3. Cashier (`/cashier`)
- Quản lý ca làm việc (mở/đóng ca)
- Xử lý thanh toán (Tiền mặt / Chuyển khoản)
- Áp dụng Voucher giảm giá
- In hóa đơn / Z-Report cuối ca

### 4. KDS - Kitchen Display System (`/kds`)
- Hiển thị đơn hàng đang chờ xử lý tại bếp
- Cập nhật trạng thái: **Pending → Preparing → Ready → Served**
- Real-time qua Socket.IO

### 5. Admin Settings (`/admin/settings`)
- **Tab 1 — Tài khoản:** CRUD users, reset mật khẩu, vô hiệu hóa tài khoản
- **Tab 2 — Voucher:** Tạo/sửa/xóa mã khuyến mãi (PERCENT / FIXED)
- **Tab 3 — Cấu hình:** Tên nhà hàng, email quản lý, thông tin License
- **Tab 4 — Đồng bộ:** Trigger revalidate ISR cache thực đơn

### 6. Menu QR (`/table/:qrToken`)
- Khách hàng quét QR tại bàn để xem thực đơn
- Không cần đăng nhập
- ISR cache, cập nhật theo lịch

---

## 🔒 Bảo mật

- **JWT Access Token** (15 phút) + **Refresh Token** (7 ngày) với Rotation
- **Bcrypt** hash mật khẩu (saltRounds: 12)
- **Rate Limiting** trên `/auth/login` và `/auth/register` chống Brute Force
- **RBAC Middleware** (`requireRole()`) bảo vệ tất cả API
- **Edge Middleware** (Next.js) chặn truy cập route trái phép ngay tại CDN edge
- **Soft Delete** user (trường `isActive`) để bảo toàn lịch sử
- **TrustedDevice** quản lý thiết bị đã đăng nhập
- **Sheet Protection** trong file Excel xuất ra (chống chỉnh sửa công thức)

---

## 📊 Tính năng xuất báo cáo Excel

File `.xlsx` được stream trực tiếp về client (không buffer vào RAM), gồm **4 sheets**:

| Sheet | Nội dung |
|-------|---------|
| Tổng quan doanh thu | Doanh thu theo ngày, SUM formula, Freeze row |
| Chi tiết đơn hàng | Mỗi row = 1 đơn, cột Món join tên các món |
| Top món bán chạy | Hạng, tên, số lượng, % doanh thu |
| Báo cáo ca | Thu ngân, mở/đóng ca, tổng thu theo phương thức |

> **Giới hạn hiệu suất:** Nếu khoảng thời gian > 90 ngày, Sheet "Chi tiết đơn" chỉ lấy 1000 records đầu tiên và hiển thị cảnh báo.

---

## 🌐 Real-time với Socket.IO

| Event | Hướng | Mô tả |
|-------|-------|-------|
| `order:new` | Server → Kitchen | Có đơn mới |
| `order:statusUpdate` | Server → All | Món cập nhật trạng thái |
| `table:statusUpdate` | Server → All | Bàn thay đổi trạng thái |
| `shift:opened` | Server → Cashier | Ca làm được mở |
| `payment:completed` | Server → All | Thanh toán thành công |

---

## 🧪 Script hữu ích

```bash
# Backend
npm run dev           # Chạy development server
npm run db:seed       # Seed dữ liệu mẫu
npx prisma studio     # Giao diện quản lý DB trực quan

# Frontend  
npm run dev           # Chạy Next.js development
npm run build         # Build production
npm run lint          # Kiểm tra lỗi ESLint
```

---

## 📝 Ghi chú phát triển

### Git Workflow
```
main ← dev ← feature/xxx
              hotfix/xxx
```

- **`main`**: Production-ready code
- **`dev`**: Integration branch — tất cả feature merge vào đây
- **`feature/*`**: Feature branches, tạo PR vào `dev`
- **`hotfix/*`**: Sửa bug khẩn cấp trên `dev`

### Commit Convention
```
feat(module): mô tả tính năng mới
fix(module): mô tả bug đã sửa
hotfix: mô tả fix khẩn cấp
refactor(module): tái cấu trúc code
docs: cập nhật tài liệu
```

---

## 📄 Giấy phép

Dự án phục vụ mục đích học thuật — Môn INT1434 Lập trình Web, PTIT.

---

<div align="center">
  <strong>RestoFlow POS</strong> — Built with ❤️ by D23CQCN01-N Team<br/>
  Trần Hoàng Đạt (N23DCCN009) · Phạm Văn Đoàn (N23DCCN010)
</div>
