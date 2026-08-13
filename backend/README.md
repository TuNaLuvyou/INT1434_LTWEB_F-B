# ⚙️ HiAI-MenuGo Backend Service

> **RESTful API & Realtime Server** cho hệ thống HiAI-MenuGo (Scan · Order · Pay)  
> Đóng vai trò là linh hồn xử lý nghiệp vụ, quản lý cơ sở dữ liệu PostgreSQL qua Prisma ORM và phát sóng các sự kiện thời gian thực qua Socket.IO.

---

## 🛠️ Công nghệ & Thư viện sử dụng

- **Core Engine:** Node.js, Express 5, TypeScript
- **Database & ORM:** PostgreSQL (Supabase), Prisma ORM (`@prisma/client`, `@prisma/adapter-pg`)
- **Realtime Communication:** Socket.IO (`socket.io`)
- **Authentication & Security:** JWT (`jsonwebtoken`), Cookie Parser, Bcrypt, Express Rate Limit
- **File & Media Storage:** Cloudinary (`cloudinary`, `multer-storage-cloudinary`)
- **Data Validation & Parsing:** Zod (`zod`), Multer
- **Export & Mail Services:** ExcelJS (`exceljs`), PDFKit (`pdfkit`), Nodemailer (`nodemailer`)

---

## 📂 Cấu trúc thư mục

```
backend/
├── prisma/
│   ├── schema.prisma       # Schema CSDL PostgreSQL (600+ dòng)
│   ├── seed.ts             # File khởi tạo dữ liệu mẫu (Admin, Menu, Bàn...)
│   └── migrations/         # Các phiên bản thay đổi cấu trúc Database
├── src/
│   ├── config/             # Cấu hình hệ thống (Cloudinary, DB, CORS, Email)
│   ├── controllers/        # Xử lý logic nghiệp vụ cho từng Endpoint API
│   ├── middlewares/        # Auth (JWT), Phân quyền (RBAC), Feature Guard, Upload
│   ├── routes/             # Định tuyến API REST (Admin, POS, KDS, Customer...)
│   ├── services/           # Các dịch vụ độc lập (VietQR, Z-Report, Export...)
│   ├── socket/             # Xử lý kết nối Realtime & phát tán sự kiện Socket.IO
│   ├── types/              # Định nghĩa TypeScript Interfaces & Types
│   ├── utils/              # Tiện ích bổ trợ (Haversine Geofencing, Response format...)
│   └── app.ts              # Entry point khởi tạo Express app & Socket server
├── .env.example            # Mẫu file cấu hình biến môi trường
├── package.json
└── tsconfig.json
```

---

## 🔑 Cấu hình biến môi trường (`.env`)

Tạo file `.env` trong thư mục `backend/` dựa trên mẫu `.env.example`:

```env
# 1. DATABASE (PostgreSQL / Supabase)
DATABASE_URL="postgresql://[user]:[pass]@[host]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://[user]:[pass]@[host]:5432/postgres"

# 2. AUTHENTICATION (JWT)
JWT_SECRET="your_jwt_secret_key"
JWT_EXPIRES_IN="7d"
JWT_ACCESS_SECRET="your_jwt_access_secret_here"   # Phải trùng khớp với FRONTEND
JWT_REFRESH_SECRET="your_jwt_refresh_secret_here"

# 3. CLOUDINARY (Upload ảnh món ăn)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# 4. SERVER CONFIG
PORT=5000
NODE_ENV="development"

# 5. FRONTEND URL & REVALIDATION
FRONTEND_URL="http://localhost:3000"
NEXTJS_URL="http://localhost:3000"
REVALIDATION_SECRET="your_revalidation_secret_here" # Phải trùng khớp với FRONTEND

# 6. EMAIL SMTP (Nodemailer - Gửi Báo cáo Z-Report)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your_email@gmail.com"
SMTP_PASS="your_app_password"
SMTP_FROM="HiAI-MenuGo POS <your_email@gmail.com>"
```

---

## 🚦 Danh sách API Endpoints chính

Hệ thống cung cấp danh sách đầy đủ các RESTful API phân theo mô-đun nghiệp vụ:

| Mô-đun Router | Prefix Path | Mô tả chức năng |
|---|---|---|
| **Auth** | `/api/auth` | Đăng nhập, gia hạn token, đăng xuất, lấy thông tin tài khoản |
| **Customer** | `/api/customer` | Xem menu công khai tại bàn, tạo đơn hàng, gọi nhân viên |
| **Cashier / POS** | `/api/cashier` | Quản lý phiên bán hàng, sơ đồ bàn, gộp/chuyển bàn, tạo đơn POS |
| **KDS (Kitchen)** | `/api/kds` | Xem danh sách món cần chế biến, cập nhật trạng thái món |
| **Payment** | `/api/payments` | Thanh toán tiền mặt, tạo VietQR động, xử lý xác nhận thanh toán |
| **Admin Menu** | `/api/admin/menu` | CRUD món ăn, biến thể (options), nhóm topping đi kèm |
| **Category** | `/api/admin/categories` | CRUD danh mục món ăn |
| **Ingredients** | `/api/admin/ingredients` | Quản lý kho nguyên vật liệu, cấu hình định lượng món (BOM) |
| **Vouchers** | `/api/admin/vouchers` | Quản lý mã giảm giá & chương trình khuyến mãi theo chi nhánh |
| **Analytics** | `/api/analytics` | Báo cáo doanh thu, top món bán chạy, hiệu suất theo ca |
| **Z-Report** | `/api/z-report` | Chốt ca bán hàng, xuất báo cáo PDF/Excel & tự động gửi Email |
| **Table** | `/api/tables` | Quản lý sơ đồ bàn, khởi tạo mã QR Code động cho từng bàn |
| **System** | `/api/system` | Cấu hình tham số hệ thống (Bật/tắt Geofencing, tọa độ GPS quán) |
| **Platform Admin**| `/api/platform-admin` | Quản lý các Tenant (nhà hàng), phân bổ gói cước (Starter/Pro/Enterprise) |

---

## 📡 Sự kiện Realtime (Socket.IO)

Tất cả các kết nối Socket.IO được phân luồng vào room theo cấu trúc `tenantId:branchId` để bảo đảm tính riêng tư và cách ly dữ liệu giữa các chi nhánh:

- `order:new`: Phát sự kiện khi có đơn hàng mới từ khách tại bàn hoặc thu ngân.
- `order:updated`: Cập nhật tiến độ món/đơn (`Pending` → `Preparing` → `Done` → `Delivered`).
- `order:voided`: Thông báo hủy món/hủy đơn hàng tức thời.
- `cart:updated`: Đồng bộ giỏ hàng thời gian thực giữa các thiết bị tại cùng một bàn.
- `table:updated` / `session:updated`: Cập nhật trạng thái bàn (Trống / Có khách) và phiên bán hàng.
- `payment:completed`: Thông báo thanh toán hoàn tất tới màn hình POS và thiết bị khách hàng.
- `inventory:updated`: Thông báo biến động số lượng kho khi xuất/nhập nguyên vật liệu.
- `sold-out:toggled`: Bật/tắt trạng thái hết món tức thời lên menu điện tử của khách.

---

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Cài đặt thư viện dependencies
```bash
cd backend
npm install
```

### 2. Cấu hình biến môi trường
Sao chép `.env.example` thành `.env` và điền đầy đủ các giá trị cấu hình tương ứng.

### 3. Đồng bộ & Nạp dữ liệu CSDL (Prisma)
```bash
# Đẩy cấu hình schema lên CSDL PostgreSQL
npx prisma db push

# Sinh Prisma Client
npx prisma generate

# Nạp dữ liệu mẫu ban đầu (Tài khoản mẫu, Menu, Bàn...)
npm run db:seed
```

### 4. Chạy server ở chế độ Development
```bash
npm run dev
# Server sẽ khởi chạy tại: http://localhost:5000
```

### 5. Build và Chạy Production
```bash
npm run build
npm start
```
