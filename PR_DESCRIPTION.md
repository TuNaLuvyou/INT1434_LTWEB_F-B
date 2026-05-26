# 📝 Pull Request Description

## 📌 Title / Tiêu đề PR
`feat(cashier & hrm): Integrate premium Cashier dashboard, KDS flows & HRM management system`

---

## 📖 English Description

### 🔍 Overview
This PR resolves the branch conflicts and code regression issues on `feature/cashier-page`. It successfully restores all lost features from the original cashier dashboard, integrates the new cashier features (canceling food, archiving sessions, checkout), and merges the latest HRM features from `dev` (attendance, schedules, roles).

### ✨ Key Features & Changes
* **Cashier Dashboard**:
  * Zinc-based premium glassmorphic UI.
  * Real-time order notification via QR & session locking workflow.
  * Added **Cancel Food** and **Archive Closed Sessions** flow.
  * Added **Payment / Checkout** process.
* **Kitchen Display System (KDS)**:
  * Optimized realtime Ticket list & status toggles.
  * Integrated **Sold Out** state sync.
* **HRM System (Merged from `dev`)**:
  * Realtime check-in/out attendance with trusted device validation.
  * Work schedules and shift management.
  * Role-based access control with the new `CASHIER` role.
* **Database & Infrastructure**:
  * Updated Prisma schema to seamlessly integrate `CASHIER` role and compound unique constraint `@@unique([sessionId, menuItemId, status])` for cart LWW conflict resolution.
  * Fully synchronized backend & frontend compiler states (0 errors).

---

## 📖 Mô tả tiếng Việt

### 🔍 Tổng quan
PR này giải quyết triệt để vấn đề xung đột và mất code trên nhánh `feature/cashier-page`. Toàn bộ code gốc của trang Cashier và KDS đã được khôi phục, tích hợp thêm các tính năng mới (hủy món, lưu trữ phiên, thanh toán) đồng thời đồng bộ hoàn toàn với các tính năng quản lý nhân sự HRM mới nhất từ nhánh `dev`.

### ✨ Các tính năng & Thay đổi chính
* **Trang Cashier (Thu ngân)**:
  * Giao diện Zinc glassmorphic cao cấp, phản hồi mượt mà.
  * Nhận thông báo gọi món theo thời gian thực và kiểm soát khóa session.
  * Tích hợp tính năng **Hủy món (Cancel Food)** và **Lưu trữ phiên đã đóng (Archive)**.
  * Quy trình **Thanh toán / Checkout** hoàn chỉnh.
* **Trang KDS (Bếp)**:
  * Tối ưu hóa luồng hiển thị ticket thời gian thực.
  * Đồng bộ trạng thái hết món (Sold Out).
* **Hệ thống HRM (Đồng bộ từ `dev`)**:
  * Quản lý điểm danh (Attendance) kết hợp xác thực thiết bị tin cậy.
  * Lịch làm việc (Schedules) và phân ca.
  * Phân quyền tài khoản với sự xuất hiện của vai trò `CASHIER`.
* **Cơ sở dữ liệu**:
  * Cập nhật Prisma schema đồng bộ vai trò `CASHIER` và ràng buộc duy nhất `@@unique([sessionId, menuItemId, status])` để tối ưu giỏ hàng.
  * Sửa lỗi biên dịch, đảm bảo dự án chạy ổn định 100% không lỗi biên dịch ở cả backend và frontend.

---

### 🛠️ Verification & Deployment Steps / Hướng dẫn chạy thử
1. Pull code mới nhất về máy.
2. Chạy lệnh sau ở cả thư mục `backend` và `frontend` để cập nhật Prisma Client:
   ```bash
   npx prisma generate
   ```
3. Chạy lệnh đồng bộ database (nếu cần):
   ```bash
   npx prisma db push
   ```
4. Khởi động môi trường dev và trải nghiệm!
