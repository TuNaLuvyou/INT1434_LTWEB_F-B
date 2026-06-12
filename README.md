# 🍽️ RestoFlow POS — Hệ thống Quản lý Nhà hàng Thông minh Real-time

> **Môn học:** INT1434 — Lập trình Web  
> **Lớp:** D23CQCN01-N  
> **Trường:** Học viện Công nghệ Bưu chính Viễn thông (PTIT)

---

## 👥 Thành viên nhóm

| STT | Họ và tên          | MSSV       | Vai trò     |
| --- | ------------------ | ---------- | ----------- |
| 1   | **Trần Hoàng Đạt** | N23DCCN009 | Nhóm trưởng |
| 2   | **Phạm Văn Đoàn**  | N23DCCN010 | Thành viên  |

---

## 📋 Tổng quan dự án

**RestoFlow POS** là hệ thống quản lý nhà hàng toàn diện, kết hợp đặt món tại bàn qua mã QR và hệ thống quản trị tại quầy (POS/Cashier). Hệ thống hoạt động theo mô hình **Real-time** đồng bộ trạng thái tức thời giữa khách hàng, nhà bếp (KDS) và thu ngân.

### Các tính năng cốt lõi:

1. **Gọi món tại bàn qua QR code**: Khách hàng quét mã QR tại bàn để truy cập thực đơn trực tuyến, tạo đơn hàng và theo dõi tiến độ món ăn theo thời gian thực.
2. **Giới hạn định vị địa lý (Geofencing)**:
   - Ngăn chặn khách hàng cố tình đặt món từ xa khi không có mặt tại nhà hàng.
   - Tính toán khoảng cách giữa thiết bị của khách hàng và tọa độ của quán thông qua **Thuật toán Haversine** trên server (`frontend/app/actions/order.actions.ts`).
   - Tích hợp cơ chế lấy toạ độ tự động có dự phòng chất lượng cao (High accuracy ➔ Low accuracy fallback) tại `frontend/app/admin/settings/SettingsClient.tsx`.
3. **Màn hình hiển thị bếp chuyên dụng (KDS)**: Nhận đơn hàng, sắp xếp thứ tự ưu tiên, chuyển trạng thái chế biến thời gian thực.
4. **Hệ thống POS & Thu ngân**: Hỗ trợ mở phiên bàn, thanh toán, in hoá đơn, quản lý ca làm việc (Shift) và doanh thu.
5. **Định mức nguyên liệu (BOM - Bill of Materials)**: Tự động trừ nguyên kho sau khi đơn hàng được chế biến thành công.
6. **Công cụ khuyến mãi (Voucher)**: Hỗ trợ giảm giá theo phần trăm hoặc số tiền cố định.
7. **Báo cáo cuối ca (Z-Report)**: Tổng kết ca làm việc và gửi báo cáo tự động qua email (Nodemailer SMTP).

---

## 🛠️ Công nghệ sử dụng chính

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

Tạo file `.env` bằng cách sao chép file `.env.example` và cấu hình các thông số (Database, JWT, Mail SMTP...) phù hợp.

- **Lưu ý**: Dự án dùng cổng **`5000`** làm mặc định cho Backend Server.

Khởi tạo database và nạp dữ liệu seed ban đầu:

```bash
# Đẩy schema lên Database và tạo Client Prisma
npx prisma db push

# Nạp dữ liệu mặc định (Admin, Món ăn, Bàn ăn mẫu...)
npm run db:seed
```

Khởi động server dev Backend:

```bash
npm run dev
# Backend chạy tại: http://localhost:5000
```

### 3. Cấu hình & Chạy Frontend

Mở một tab terminal mới và chuyển đến thư mục frontend:

```bash
cd frontend
npm install
```

Tạo file `.env` bằng cách sao chép file `.env.example` và cấu hình các thông số (đặc biệt là cổng kết nối API tới Backend `5000`).

Sinh mã Prisma Client cho Next.js Server Components:

```bash
npx prisma generate
```

Khởi động server dev Frontend:

```bash
npm run dev
# Frontend chạy tại: http://localhost:3000
```

---

## 🔑 Tài khoản mặc định (sau khi seed)

Mật khẩu đăng nhập mặc định cho toàn bộ các tài khoản dưới đây là: **`Demo@1234`**

| Vai trò (Role) | Email đăng nhập          | Quyền hạn                                                     |
| -------------- | ------------------------ | ------------------------------------------------------------- |
| **ADMIN**      | `admin@restoflow.demo`   | Toàn quyền, cấu hình hệ thống, quản lý tài khoản & doanh thu  |
| **MANAGER**    | `manager@restoflow.demo` | Quản lý món ăn, tồn kho nguyên vật liệu, cấu hình mã giảm giá |
| **CASHIER**    | `cashier@restoflow.demo` | Mở ca POS, duyệt hóa đơn tại bàn, thanh toán cho khách        |
| **KITCHEN**    | `kitchen@restoflow.demo` | Tiếp nhận và chế biến món ăn thông qua màn hình KDS           |

---

## ⚙️ Thiết lập Geofencing (Định vị) để thử nghiệm local

1. Đăng nhập vào trang quản trị: `http://localhost:3000/login` bằng tài khoản `admin@restoflow.demo`.
2. Truy cập mục **Cài đặt hệ thống** ở menu bên trái.
3. Trong tab **Định vị (Geofencing)**:
   - Bật **Giới hạn định vị**.
   - Nhập toạ độ vĩ độ/kinh độ của quán (hoặc bấm **Lấy GPS hiện tại** để nhận toạ độ thực tế của thiết bị).
   - Điều chỉnh **Bán kính cho phép đặt món** (mét).
   - Bấm **Lưu thay đổi cấu hình**.
4. Truy cập trang gọi món của bàn: `http://localhost:3000/table/1`.
5. Sử dụng tính năng giả lập vị trí của Chrome (DevTools ➔ biểu tượng 3 chấm ➔ **More tools** ➔ **Sensors**) để nhập toạ độ khớp với toạ độ quán và thực hiện gửi món.

---

## 📝 Git Workflow & Commit Convention

- **Nhánh chính:** `main` (Production).
- **Phát triển tính năng:** Tạo nhánh `feature/*` hoặc `hotfix/*` từ `main`.
- **Cấu trúc Commit:** `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`

---

<div align="center">
  <strong>RestoFlow POS</strong> — Được phát triển với ❤️ bởi nhóm PTIT D23CQCN01-N<br/>
  Trần Hoàng Đạt (N23DCCN009) · Phạm Văn Đoàn (N23DCCN010)
</div>
