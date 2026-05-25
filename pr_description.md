# Mô tả Pull Request (PR)

## 📌 Tiêu đề PR
```text
feat(hrm): hoàn thiện chấm công liên tục, lịch sử chấm công và sửa lỗi thu hồi thiết bị
```

---

## 📝 Tổng quan
PR này hoàn thành các nâng cấp cốt lõi cho phân hệ Quản lý nhân sự (HRM) liên quan đến cơ chế **Chấm công liên tục (nhiều ca/ngày)**, **Lịch sử chấm công cá nhân real-time**, **Đăng ký thiết bị tin cậy an toàn** và **Sửa lỗi nghiêm trọng khi thu hồi thiết bị**.

---

## 🚀 Các thay đổi chính

### 1. Quản lý Chấm công & Ca làm việc
* **Chấm công nhiều ca/ngày**: Cho phép nhân viên thực hiện check-in bắt đầu ca làm mới ngay lập tức sau khi đã check-out ca trước trong cùng ngày.
* **Đồng nhất nút bấm**: Hủy bỏ các chữ trung gian như "Check-in lại" hay "Bắt đầu ca mới", đồng nhất nhãn hiển thị duy nhất là **`BẮT ĐẦU CA LÀM (CHECK-IN)`** cho mọi ca làm.
* **Bảng điều khiển Admin Real-time**: Cập nhật API `/today` giúp **ADMIN** và **MANAGER** có thể theo dõi danh sách chấm công của tất cả mọi nhân viên trong ngày theo thời gian thực.

### 2. Lịch sử chấm công cho Nhân viên
* Đăng ký thành công endpoint bảo mật `/api/attendance/my-history` cho nhân sự truy vấn lịch sử cá nhân.
* Tích hợp bảng **"Lịch Sử Chấm Công Của Tôi"** giao diện tối cao cấp ngay dưới khung đồng hồ số tại Cổng Nhân Viên, hiển thị rõ ràng ngày giờ thực tế kèm trạng thái phê duyệt (*Đã duyệt / Chờ duyệt*).

### 3. Quản lý thiết bị Tin cậy (Cổng Admin)
* **Lọc tài khoản theo vai trò**: Chỉ hiển thị các tài khoản có vai trò **`STAFF`** tại ô chọn người sở hữu khi đăng ký thiết bị.
* **Mở rộng ô dán Token**: Giãn độ rộng khung thông báo lỗi & dán token thủ công ra toàn màn hình (`w-full`) giúp bố cục giao diện thẳng hàng, trực quan.
* **Ẩn token bảo mật**: Chuyển cột Token về vị trí kế cuối, ẩn chuỗi token thô để tránh rò rỉ dữ liệu và thiết kế nút **`Sao chép`** (`bg-violet-600/10`) để một-click copy nhanh chóng.

### 4. Sửa lỗi Thu hồi thiết bị (Revoke Device)
* **Xóa bắc cầu an toàn (Cascade Delete)**: Sử dụng cơ chế Prisma `$transaction` để tự động dọn sạch các bản ghi chấm công (`Attendance`) liên kết với thiết bị trước khi xóa thiết bị. Điều này khắc phục triệt để lỗi vi phạm ràng buộc khóa ngoại PostgreSQL (`P2003`) khi Admin bấm thu hồi thiết bị.

---

## 🧪 Kết quả kiểm thử & Độ ổn định
* **Type-checking**: Chạy `npx tsc --noEmit` phía backend thành công hoàn hảo 100% không cảnh báo.
* **Production Build**: Chạy lệnh build phía frontend `npm run build` thành công xuất sắc, sẵn sàng triển khai.
