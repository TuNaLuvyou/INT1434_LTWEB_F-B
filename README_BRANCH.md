# BRANCH DESCRIPTION: feature/hrm-manager

Tài liệu tóm tắt toàn bộ các tính năng, nâng cấp công nghệ và thay đổi đã thực hiện thành công trên nhánh `feature/hrm-manager`. Bạn có thể sử dụng nội dung này để làm mô tả cho **Pull Request (PR)** hoặc báo cáo tiến độ.

---

## 🌟 Tổng Quan Nhánh (Branch Summary)
Nhánh `feature/hrm-manager` tập trung vào việc tái cấu trúc hệ thống quản trị, thiết lập mô hình **Phân quyền dựa trên vai trò (Role-Based Access Control - RBAC)** chuẩn chỉ, xây dựng các cổng thông tin nhân sự và cơ chế bảo mật thiết bị tin cậy nhằm đáp ứng vận hành nhà hàng thực tế.

---

## 🛠️ Các Tính Năng & Nâng Cấp Đã Thực Hiện

### 1. Phân Quyền Vai Trò Hệ Thống (Fine-Grained RBAC)
*   **Mở rộng Schema Database**: Thêm vai trò `CASHIER` vào enum `Role` trong Prisma schema và đồng bộ hóa Cơ sở dữ liệu Supabase.
*   **Bảo vệ định tuyến (Middleware Protection)**: 
    *   Cấu hình `ROUTE_PERMISSIONS` nghiêm ngặt tại `middleware.ts` để chặn truy cập trái phép.
    *   Bảo vệ cổng POS (`/pos`) chỉ cho phép `ADMIN`, `MANAGER` và `CASHIER`.
    *   Bảo vệ cổng bếp (`/kds`) chỉ cho phép `ADMIN`, `MANAGER` và `KITCHEN`.
*   **Bộ lọc trang chủ thông minh (Role-Based UI Filtering)**: 
    *   **Tài khoản Máy Thu Ngân (`CASHIER`)**: Chỉ hiển thị cổng bán hàng **POS** và **Table** (quản lý bàn ăn). Ẩn cổng nhân viên và quản trị.
    *   **Tài khoản Máy Bếp (`KITCHEN`)**: Chỉ hiển thị màn hình điều phối bếp **KDS**. Ẩn tất cả các cổng khác.
    *   **Tài khoản Nhân viên (`STAFF`)**: Chỉ hiển thị **Cổng Nhân Viên** (chấm công & xem lịch trực).
    *   **Tài khoản Quản trị (`ADMIN`/`MANAGER`)**: Hiển thị toàn bộ hệ sinh thái dịch vụ.
*   **Căn giữa giao diện thông minh**: Khi nhân sự đăng nhập chỉ hiển thị duy nhất 1 thẻ ứng dụng (như Bếp hoặc Nhân viên), thẻ đó sẽ tự động được đưa vào chính giữa trang chủ với bố cục cân đối.

### 2. Quản Lý Thiết Bị Tin Cậy (Trusted Devices Management)
*   **Tích hợp điều hướng**: Thêm tab **Thiết bị tin cậy** đồng bộ vào thanh quản trị cao cấp của Admin Suite.
*   **Giao diện Đăng ký Thiết bị Dark-Theme Premium**:
    *   Thay thế giao diện sáng nhạt cũ bằng thiết kế **Dark Glassmorphism** hiện đại.
    *   **Nâng cấp Trải nghiệm (UX)**: Loại bỏ việc Admin phải nhập mã chuỗi UUID ID của nhân viên bằng cách tích hợp **Dropdown Selector** tự động lấy danh sách nhân viên từ Backend.
    *   **Hiển thị Token An Toàn**: Thiết kế hộp thoại cảnh báo bảo mật trực quan kèm nút **Copy nhanh** Token thiết bị dùng cho cấu hình chấm công lần đầu.
    *   **Danh sách thiết bị tin cậy**: Hiển thị tên thiết bị, người sở hữu, thời gian check-in gần nhất và tích hợp tính năng **Thu hồi thiết bị** (Revoke) an toàn.

### 3. Cổng Nhân Viên & Chấm Công Lịch Làm Việc (Employee Portal)
*   **Cổng nhân viên `/attendance`**: Giao diện tối chuyên nghiệp với 2 khu vực:
    *   **Time Clock (Chấm công)**: Thực hiện Check-in / Check-out thời gian thực trên các thiết bị đã được Admin phê duyệt.
    *   **My Schedule (Lịch trực của tôi)**: Theo dõi lịch làm việc cá nhân được sắp xếp theo ca trực.

### 4. Nâng Cấp Kịch Bản Khởi Tạo Cơ Sở Dữ Liệu (Seed Update)
*   **Sửa lỗi Prisma Upsert**: Sửa lỗi hàm `upsert` trong `seed.ts` không tự động cập nhật trường `role` và `name` khi tài khoản đã tồn tại.
*   **Bổ sung tài khoản mẫu**:
    *   `cashier@restoflow.demo` (Vai trò: `CASHIER`) - Mật khẩu: `Demo@1234`
    *   `staff@restoflow.demo` (Vai trò: `STAFF`) - Mật khẩu: `Demo@1234`

---

## 📈 Trạng Thái Biên Dịch & Ổn Định
*   **Build Frontend**: Lệnh `npm run build` chạy thành công 100%, tạo ra gói sản phẩm tĩnh tối ưu, **không có bất kỳ lỗi biên dịch nào**.
*   **Database**: Đã được đồng bộ đầy đủ cấu trúc enum mới và dữ liệu seed thực tế.

---

## 👥 Danh Sách Tài Khoản Thử Nghiệm (Mật khẩu chung: `Demo@1234`)
1.  **Quản trị viên**: `admin@restoflow.demo` (Xem toàn bộ hệ thống & Quản lý thiết bị)
2.  **Máy thu ngân**: `cashier@restoflow.demo` (Chỉ xem POS & Table)
3.  **Máy bếp**: `kitchen@restoflow.demo` (Chỉ xem KDS)
4.  **Nhân viên**: `staff@restoflow.demo` (Chỉ xem Cổng chấm công nhân viên)
