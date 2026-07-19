# 🍽️ HiAI-MenuGo POS — Hệ thống Quản lý Nhà hàng Thông minh Real-time

**HiAI-MenuGo POS** là hệ thống phần mềm dưới dạng dịch vụ (SaaS) quản lý nhà hàng toàn diện, kết hợp đặt món tại bàn qua mã QR và hệ thống quản trị tại quầy (POS/Cashier). Hệ thống hoạt động theo mô hình **Real-time** đồng bộ trạng thái tức thời giữa khách hàng, nhà bếp (KDS) và thu ngân.

---

## 🌟 Những gì đã làm được (Hoàn thiện)

Hệ thống **HiAI-MenuGo POS** đã hoàn thiện một hệ sinh thái mạnh mẽ, đáp ứng vòng đời quản lý nhà hàng từ đặt món đến thanh toán và báo cáo:

1. **Kiến trúc Hệ thống (Core & Database):**
   - Hoàn thiện toàn bộ Database Schema (PostgreSQL/Supabase) cho các module: Auth, Bàn, Đơn hàng, Kho NVL, Thanh toán, Voucher, Audit Log, System Config.
   - Xây dựng thành công kiến trúc Multi-tenant (SaaS) và Multi-branch (chuỗi chi nhánh).
2. **Khách hàng (Public QR Menu):**
   - Gọi món tại bàn qua QR code không cần đăng nhập.
   - Giỏ hàng (Cart) đồng bộ thời gian thực (Real-time).
   - Tích hợp **Giới hạn định vị địa lý (Geofencing)** ngăn chặn đặt hàng từ xa bằng Thuật toán Haversine.
3. **Nhà bếp (KDS - Kitchen Display System):**
   - Màn hình tiếp nhận đơn hàng, chuyển trạng thái (Preparing ➔ Done ➔ Delivered) và Void món ăn tức thời thông qua Socket.IO.
4. **Thu ngân & POS:**
   - Quản lý sơ đồ bàn, mở/đóng phiên, duyệt đơn hàng.
   - Thanh toán tiền mặt (CASH) và chuyển khoản (VietQR).
5. **Quản trị (Admin Dashboard):**
   - Quản lý danh mục, món ăn (Upload ảnh Cloudinary).
   - Cấu hình Voucher/Khuyến mãi.
   - Kho hàng (Inventory/BOM): Tự động trừ nguyên vật liệu khi bán, cảnh báo sắp hết hàng.
   - Z-Report (Báo cáo cuối ca): Thống kê doanh thu, gửi email tự động qua Nodemailer.
   - Phân quyền động (RBAC).

---

## 🚧 Những tính năng chưa làm (Cần phát triển thêm)

Để hệ thống hoàn thiện như một sản phẩm thương mại, dưới đây là các tính năng dự kiến sẽ phát triển:

- **Màn hình/App cho Nhân viên phục vụ (Staff App):** Nhận thông báo mang món, xử lý yêu cầu "Gọi nhân viên" từ bàn.
- **Thành viên & Tích điểm (Loyalty/Membership):** Tích điểm tự động sau khi thanh toán, phân hạng thành viên.
- **Cổng thanh toán mở rộng:** Tích hợp trực tiếp MOMO, ZALOPAY, VNPAY (đã có thiết kế Factory Pattern chờ sẵn).
- **Chia hóa đơn (Split Bill):** Tách hóa đơn theo món hoặc theo số lượng người thanh toán.
- **Tùy chỉnh giao diện quán (Branding):** Cho phép các quán tải logo và đổi màu chủ đạo (Hiện tại mới có database schema, chưa có API thực).
- **API Tích hợp (Integration):** Cung cấp API/Webhook cho các bên thứ ba (ERP, Kế toán).
- **AI Features:** Gợi ý món ăn, dự báo nguyên vật liệu, tự động dịch thực đơn.

---

## 🛠️ Công nghệ sử dụng

- **Backend:** Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL (Supabase), Socket.IO, JWT, Nodemailer.
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS, Zustand, Recharts, Lucide React.

---

## 🚀 Hướng dẫn cài đặt & chạy dự án

### Yêu cầu hệ thống

- **Node.js** ≥ 18.x
- **PostgreSQL** ≥ 14 (hoặc dịch vụ Cloud PostgreSQL như Supabase)

### 1. Clone repository và chuẩn bị

```bash
git clone https://github.com/TuNaLuvyou/INT1434_LTWEB_F-B.git
cd INT1434_LTWEB_F-B
```

### 2. Cấu hình & Chạy Backend

```bash
cd backend
npm install
```

Tạo file `.env` bằng cách sao chép file `.env.example` và điền các thông số. Mặc định Backend chạy tại cổng **`5000`**.

```bash
# Đẩy schema lên Database và tạo Client Prisma
npx prisma db push
npx prisma generate

# Nạp dữ liệu mặc định (Admin, Món ăn, Bàn ăn mẫu...)
npm run db:seed

# Khởi động server
npm run dev
```

### 3. Cấu hình & Chạy Frontend

Mở tab terminal mới:

```bash
cd frontend
npm install
```

Tạo file `.env` từ `.env.example`. Chú ý cấu hình `NEXT_PUBLIC_API_URL` trỏ về backend `http://127.0.0.1:5000`.

```bash
# Sinh mã Prisma Client cho Frontend
npx prisma generate

# Khởi động Next.js
npm run dev
```

---

## 🔑 Tài khoản mặc định (sau khi seed)

Mật khẩu đăng nhập mặc định: **`Demo@1234`**

| Vai trò (Role) | Email đăng nhập          | Quyền hạn                                                     |
| -------------- | ------------------------ | ------------------------------------------------------------- |
| **ADMIN**      | `admin@hiaimenugo.demo`   | Toàn quyền, cấu hình hệ thống, quản lý tài khoản & doanh thu  |
| **MANAGER**    | `manager@hiaimenugo.demo` | Quản lý món ăn, tồn kho nguyên vật liệu, cấu hình mã giảm giá |
| **CASHIER**    | `cashier@hiaimenugo.demo` | Mở ca POS, duyệt hóa đơn tại bàn, thanh toán cho khách        |
| **KITCHEN**    | `kitchen@hiaimenugo.demo` | Tiếp nhận và chế biến món ăn thông qua màn hình KDS           |

---

## ⚙️ Thiết lập Geofencing (Định vị) để thử nghiệm local

1. Đăng nhập admin.
2. Truy cập **Cài đặt hệ thống** ➔ tab **Định vị (Geofencing)**.
3. Bật **Giới hạn định vị**, nhập toạ độ, chỉnh bán kính ➔ **Lưu**.
4. Truy cập `http://localhost:3000/table/1`.
5. Dùng DevTools của Chrome (Sensors) để giả lập vị trí GPS khớp với toạ độ quán và đặt món.

---

## 📝 Git Workflow & Commit Convention

- **Nhánh chính:** `main` (Production).
- **Phát triển tính năng:** Tạo nhánh `feature/*` hoặc `hotfix/*` từ `main`.
- **Cấu trúc Commit:** `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`

---

<div align="center">
  <strong>HiAI-MenuGo POS</strong> — Được phát triển với ❤️ bởi<br/>
  Trần Hoàng Đạt · Phạm Văn Đoàn
</div>
