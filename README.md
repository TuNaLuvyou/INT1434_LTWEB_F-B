# 🍽️ HiAI-MenuGo — Hệ thống Quản lý Nhà hàng Thông minh Real-time

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-green?logo=nodedotjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma%206-blue?logo=postgresql)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-white?logo=socketdotio)
![License](https://img.shields.io/badge/license-ISC-lightgrey)

**Môn học:** INT1434 — Lập trình Web  
**Lớp:** D23COCN01-N  
**Nhóm:** HiAI-MenuGo

</div>

---

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng nổi bật](#-tính-năng-nổi-bật)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Tech Stack](#-tech-stack)
- [Cài đặt & Chạy thử](#-cài-đặt--chạy-thử)
- [Biến môi trường](#-biến-môi-trường)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [API Documentation](#-api-documentation)
- [RBAC - Phân quyền](#-rbac---phân-quyền)
- [Thành viên](#-thành-viên)

---

## 🚀 Giới thiệu

**HiAI-MenuGo** là nền tảng SaaS quản lý nhà hàng đa chi nhánh (Multi-Tenant) theo thời gian thực. Hệ thống bao gồm:

- 📱 **QR Menu** — Khách quét mã QR để đặt món ngay tại bàn, không cần tải app
- 🖥️ **POS & Cashier** — Giao diện thu ngân tích hợp đầy đủ tính năng thanh toán
- 🍳 **KDS (Kitchen Display System)** — Màn hình bếp cập nhật đơn hàng real-time
- 📊 **Dashboard Analytics** — Báo cáo doanh thu, xu hướng bán hàng, lịch sử khách hàng
- 🏢 **Multi-Tenant** — Hỗ trợ nhiều doanh nghiệp, nhiều chi nhánh độc lập trên cùng nền tảng

---

## ✨ Tính năng nổi bật

### 👨‍💼 Quản lý (Admin/Manager)
| Tính năng | Mô tả |
|-----------|-------|
| 🗂️ Quản lý Menu | Thêm/sửa/xóa món, danh mục, topping, modifier groups |
| 🏪 Quản lý chi nhánh | Tạo & cấu hình nhiều chi nhánh trong một tài khoản |
| 📦 Quản lý kho nguyên liệu | BOM (Bill of Materials), trừ kho tự động khi bán hàng |
| 🎫 Voucher & Loyalty | Mã giảm giá, tích điểm, hạng thành viên (Vàng/Bạc) |
| 📈 Analytics Dashboard | Doanh thu theo giờ/tuần/tháng, top món bán chạy |
| 🧾 Z-Report | Báo cáo ca làm việc, xuất Excel/PDF |
| 🎨 Branding | Logo, màu sắc thương hiệu riêng cho mỗi tenant |
| 🔑 API Keys & Webhook | Tích hợp hệ thống bên ngoài qua Open API |

### 🛒 Khách hàng (QR Menu)
| Tính năng | Mô tả |
|-----------|-------|
| 📷 Quét QR đặt món | Không cần tài khoản, không cần tải app |
| 🥤 Tùy chọn món | Size, đường, đá, topping theo từng loại đồ uống |
| 💳 Thanh toán QR | VietQR tự động, tích điểm qua số điện thoại |
| 📋 Theo dõi đơn | Xem lịch sử đặt món và trạng thái chế biến theo thời gian thực |

### 🍳 Bếp & Thu ngân
| Tính năng | Mô tả |
|-----------|-------|
| 🖥️ KDS | Màn hình bếp hiển thị đơn, chuyển trạng thái PENDING→PREPARING→DONE |
| 💰 POS Cashier | Tạo đơn, áp dụng voucher, thanh toán tiền mặt/chuyển khoản |
| 📤 In phiếu | In phiếu bếp và hóa đơn thanh toán |

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────┐
│                  CLIENT LAYER                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ QR Menu  │  │  Admin   │  │ KDS / Cashier│  │
│  │(Khách)   │  │Dashboard │  │  (Nhân viên) │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
└───────┼─────────────┼───────────────┼────────────┘
        │             │               │
        ▼             ▼               ▼
┌─────────────────────────────────────────────────┐
│           Next.js 16 Frontend (Port 3000)        │
│  App Router · Zustand · TailwindCSS · Socket.IO  │
└────────────────────┬────────────────────────────┘
                     │ HTTP/WS
                     ▼
┌─────────────────────────────────────────────────┐
│        Express 5 + Socket.IO Backend (Port 5001) │
│     JWT Auth · Zod · Prisma 6 · Rate Limit       │
└──────────┬───────────────────┬───────────────────┘
           │                   │
           ▼                   ▼
    ┌──────────────┐   ┌───────────────┐
    │  PostgreSQL  │   │  Redis (opt.) │
    │  (Supabase)  │   │  BullMQ Queue │
    └──────────────┘   └───────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Công nghệ | Phiên bản | Mô tả |
|-----------|-----------|-------|
| Next.js | 16.2.6 | App Router, SSR/CSR |
| React | 19 | UI Framework |
| TailwindCSS | 4 | Styling |
| Zustand | 5 | State Management |
| Socket.IO Client | 4.8 | Realtime |
| Lucide React | Latest | Icon Library |
| QRCode.react | 4.2 | Tạo mã QR |
| React Hot Toast | 2.6 | Notifications |

### Backend
| Công nghệ | Phiên bản | Mô tả |
|-----------|-----------|-------|
| Node.js + Express | 5 | REST API Server |
| TypeScript | 6 | Type Safety |
| Prisma | 6.19 | ORM + PostgreSQL |
| Socket.IO | 4.8 | Realtime Engine |
| JWT | 9 | Authentication |
| Zod | 4 | Validation |
| Cloudinary | — | Image Upload |
| PDFKit | 0.18 | PDF Generation |
| ExcelJS | 4 | Excel Export |
| BullMQ + Redis | — | Background Jobs |

---

## 🚀 Cài đặt & Chạy thử

### Yêu cầu
- Node.js ≥ 18
- PostgreSQL (hoặc dùng Supabase)
- Redis (tùy chọn — dùng cho webhook queue)

### 1. Clone repository

```bash
git clone https://github.com/TuNaLuvyou/INT1434_LTWEB_F-B.git
cd INT1434_LTWEB_F-B
```

### 2. Cài đặt Backend

```bash
cd backend
cp .env.example .env
# Điền các biến môi trường vào .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed    # Tạo dữ liệu mẫu
npm run dev        # Chạy tại http://localhost:5001
```

### 3. Cài đặt Frontend

```bash
cd frontend
cp .env.example .env.local
# Điền NEXT_PUBLIC_API_URL=http://localhost:5001
npm install
npm run dev        # Chạy tại http://localhost:3000
```

---

## 🔐 Biến môi trường

### Backend (`backend/.env`)
```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"
DIRECT_URL="postgresql://user:password@host:5432/dbname"

# JWT
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_QR_SECRET="your-qr-secret"

# Cloudinary (Upload ảnh)
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Redis (Tùy chọn)
REDIS_URL="redis://localhost:6379"

# Port
PORT=5001
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

---

## 📁 Cấu trúc thư mục

```
INT1434_LTWEB_F-B/
├── backend/                    # Express API Server
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (~40 models)
│   │   ├── migrations/         # Migration files
│   │   └── seed.ts             # Dữ liệu mẫu
│   └── src/
│       ├── app.ts              # Entry point
│       ├── config/             # Prisma, Redis, Cloudinary
│       ├── controllers/        # Request handlers (25 controllers)
│       ├── middlewares/        # Auth, RBAC, Validation
│       ├── routes/             # API Routes (25 route files)
│       ├── services/           # Business logic
│       │   └── payment/        # Payment Factory Pattern
│       ├── socket/             # Socket.IO handlers & events
│       ├── utils/              # JWT, Password, Response helpers
│       └── workers/            # BullMQ webhook worker
│
├── frontend/                   # Next.js App
│   ├── app/
│   │   ├── admin/              # Admin pages (Dashboard, Menu, ...)
│   │   ├── pos/                # POS Cashier
│   │   ├── kds/                # Kitchen Display
│   │   ├── table/[tableId]/    # QR Menu khách hàng
│   │   ├── platform-admin/     # SaaS Platform Admin
│   │   └── receipt/            # Hóa đơn
│   ├── components/
│   │   ├── admin/              # AdminSidebar, AdminHeader, ...
│   │   ├── floor/              # TableQRCode
│   │   ├── inventory/          # BomEditor, IngredientModal
│   │   └── print/              # KitchenTicket, Receipt templates
│   ├── context/                # i18nContext (đa ngôn ngữ vi/en)
│   ├── hooks/                  # useSocket, useRole, useCartSync
│   ├── lib/                    # API client, auth helpers
│   └── stores/                 # Zustand stores (auth, cart)
│
├── docs/                       # Tài liệu dự án
├── .gitignore
└── README.md
```

---

## 📡 API Documentation

### Auth
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/refresh` | Làm mới Access Token |
| GET | `/api/auth/me` | Thông tin người dùng hiện tại |
| POST | `/api/auth/logout` | Đăng xuất |

### Menu (Public - QR)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/menu/:tableId` | Lấy menu theo bàn |
| GET | `/api/menu/items` | Danh sách món |

### Analytics
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/analytics/today-overview` | Tổng quan doanh thu hôm nay |
| GET | `/api/analytics/revenue` | Doanh thu theo thời gian |
| GET | `/api/analytics/top-selling` | Món bán chạy nhất |

> **Xem đầy đủ API:** `/api/health` và thư mục `backend/src/routes/`

---

## 🔒 RBAC - Phân quyền

| Role | Phạm vi | Quyền truy cập |
|------|---------|----------------|
| `PLATFORM_ADMIN` | SaaS Operator | Quản lý toàn nền tảng, **KHÔNG** truy cập dữ liệu kinh doanh của tenant |
| `ADMIN` | Chủ doanh nghiệp | Toàn bộ tính năng trong tenant |
| `MANAGER` | Quản lý chi nhánh | Chỉ chi nhánh được giao |
| `KITCHEN` | Bếp / Pha chế | KDS + toggle hết món |
| `CASHIER` | Thu ngân | POS + thanh toán + hoàn kho |

---

## 📊 Database Models

Hệ thống bao gồm **~40 Prisma Models** được phân chia theo các nhóm:

- **SaaS Core:** `Tenant`, `Branch`, `TenantUser`, `SystemConfig`, `TenantBranding`
- **Menu:** `Category`, `MenuItem`, `ModifierGroup`, `ModifierOption`
- **Order:** `Table`, `TableSession`, `OrderItem`
- **Payment:** `Payment`, `Shift`, `Voucher`
- **Loyalty:** `Customer`, `MembershipTier`, `CustomerPointLog`
- **Inventory:** `Ingredient`, `BOM`, `InventoryLog`
- **Analytics:** `AuditLog`
- **Integration:** `ApiKey`, `Webhook`, `WebhookDelivery`
- **Subscription:** `SubscriptionPlan`, `TenantSubscription`, `SubscriptionInvoice`

---

## 👥 Thành viên

| Họ tên | MSSV | Vai trò |
|--------|------|---------|
| Trần Tú | D23XXXX | Frontend Lead |
| Thành viên 2 | D23XXXX | Backend |
| Thành viên 3 | D23XXXX | Database & DevOps |

---

## 📄 License

ISC © 2026 HiAI-MenuGo Team

---

<div align="center">
Made with ❤️ by HiAI-MenuGo Team — INT1434 LTWEB
</div>
