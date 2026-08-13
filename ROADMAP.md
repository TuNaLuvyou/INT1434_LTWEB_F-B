# HiAI-MenuGo — Roadmap & Gap Analysis

> Tệp này dùng để theo dõi tiến độ dự án, xác định các hạng mục còn thiếu và ghi chú định hướng phát triển.

---

## ✅ ĐÃ HOÀN THÀNH

### Nền tảng & Auth
- [x] Cấu trúc Frontend Next.js App Router
- [x] Cấu trúc Backend Express + Prisma + PostgreSQL
- [x] JWT Auth, Refresh Token, Đăng nhập
- [x] Phân quyền RBAC (ADMIN / MANAGER / KITCHEN / CASHIER / PLATFORM_ADMIN)
- [x] Multi-Tenant isolation (tenantId trong tất cả query)
- [x] Branch isolation (branchId cho MANAGER)

### Menu & Danh mục
- [x] CRUD danh mục món ăn
- [x] CRUD món ăn (tên, giá, ảnh, mô tả, trạng thái, sold-out)
- [x] Quản lý Tùy chọn Kích thước (Size S/M/L/XL) & Topping đồ uống — Đồng bộ hoàn chỉnh trên Admin, POS gọi món và Menu quét QR khách hàng.
- [x] BranchMenuItem override (giá / sold-out riêng theo chi nhánh)

### Bàn & QR
- [x] Quản lý bàn + tạo QR Code
- [x] Table Session (mở / đóng phiên)
- [x] Khách quét QR → truy cập menu → tạo phiên gọi món

### Order Flow
- [x] Giỏ hàng khách, ghi chú món, gọi thêm, gửi order
- [x] Realtime Socket.IO (bếp, quầy pha chế, thu ngân, sơ đồ bàn)
- [x] Geofencing (schema + config, cần kiểm tra enforcement trên frontend)

### KDS & POS
- [x] KDS: Pending → Preparing → Done, void món, sold-out realtime
- [x] POS/Cashier: duyệt món, thanh toán tiền mặt / chuyển khoản, đóng phiên
- [x] Tài khoản ngân hàng + VietQR (SePay webhook)

### Voucher & Loyalty
- [x] Voucher cơ bản (PERCENT / FIXED, giới hạn usage, ngày hết hạn)
- [x] Voucher theo chi nhánh (VoucherBranch)
- [x] Hồ sơ khách hàng thành viên (Customer + phone lookup)
- [x] Tích điểm & phân hạng (MembershipTier, CustomerPointLog)
- [x] UI quản lý hạng thành viên (MembershipTab)

### Inventory / BOM
- [x] Quản lý nguyên liệu (CRUD, tồn kho, minStock)
- [x] BOM (Bill of Materials — định mức nguyên liệu theo món)
- [x] InventoryLog (lịch sử xuất nhập kho)
- [x] BranchIngredient (tồn kho riêng theo chi nhánh)

### Analytics & Reports
- [x] Dashboard (doanh thu, đơn hàng, top món, realtime) — theo chi nhánh hoặc toàn hệ thống
- [x] Z-Report (xem preview, xuất PDF, Excel, gửi Email) — theo chi nhánh hoặc toàn doanh nghiệp
- [x] Analytics API (revenue, peak hours, top selling, export Excel)

### Platform Admin
- [x] Quản lý tenant, chi nhánh
- [x] Subscription Plans (Starter / Professional / Enterprise) — schema hoàn chỉnh
- [x] Feature Gating / Usage Limit service
- [x] Branding (logo AI, màu sắc, tên hiển thị)

### Quản trị nội bộ
- [x] Custom Role + Permission (schema + CRUD UI)
- [x] Quản lý nhân viên (thêm, phân quyền, chi nhánh)
- [x] Audit Log (schema — chưa có UI)
- [x] Translate service (AI dịch tên món)

---

## ❌ CÒN THIẾU — PHASE 1 CẦN LÀM

### 🔴 BLOCKING — Phải làm trước khi Production

| Hạng mục | Mô tả | Quyết định |
|---|---|---|
| **Helmet + Rate Limiting** | Bảo mật HTTP headers và chống brute-force. Chưa có trong backend. | Cần làm |
| **Input Validation (Zod)** | Controllers đang trust input trực tiếp, chưa có schema validation layer. | Cần làm |
| **Refresh Token Rotation** | Cần xác nhận token cũ bị invalidate sau khi refresh (security hardening). | Cần làm |

---

### 🟡 ANALYTICS & REPORTS MỞ RỘNG

| Hạng mục | Mô tả | Quyết định |
|---|---|---|
| **Lịch sử giao dịch khách — UI** | Backend có đủ data (`payments` + `pointLogs` theo `customerId`). | Tích hợp vào trang **Dashboard Admin** — thêm tab/section xem lịch sử giao dịch từng khách hàng |
| **Báo cáo theo nhân viên** | Hiệu suất thu ngân / bếp — số đơn, doanh thu, thời gian xử lý. | Cần làm |
| **Báo cáo theo tuần / tháng — chart** | Z-Report có nhưng không có dashboard chart tổng hợp theo kỳ dài hơn. | Cần làm |

---

### 🟡 BRANDING & UX

| Hạng mục | Mô tả | Quyết định |
|---|---|---|
| **Banner / hình nền QR menu** | `TenantBranding` có logo + màu nhưng chưa có `bannerUrl`, `backgroundUrl` cho trang menu khách. | Cần làm |
| **QR code nhúng logo tenant** | QR hiện tại là chuẩn, chưa nhúng logo vào giữa để brand đẹp hơn. | Cần làm |
| **Custom domain cho tenant** | `Tenant.domain` có trong schema nhưng frontend chưa có routing theo domain riêng. | Cần làm |
| **i18n — Đa ngôn ngữ (vi/en)** | Chỉ có translate service dịch tên món. Chưa có i18n toàn bộ giao diện admin + menu khách. | Cần làm |

---

### 🟡 QUẢN TRỊ CÒN THIẾU UI

| Hạng mục | Mô tả | Quyết định |
|---|---|---|
| **Audit Log UI** | Schema `AuditLog` có nhưng Platform Admin chưa có trang xem log. | Cần làm |
| **Subscription Invoice UI** | Schema `SubscriptionInvoice` + `SubscriptionPayment` có nhưng chưa có UI quản lý hóa đơn thuê bao. | Cần làm |
| **Onboarding cho tenant mới** | Chưa có flow hướng dẫn thiết lập lần đầu (tạo chi nhánh, menu, bàn, nhân viên). | Cần làm |

---

### 🔵 PRODUCTION HARDENING & SCALE

| Hạng mục | Mô tả | Quyết định |
|---|---|---|
| **Redis** | Cần cho Socket.IO horizontal scale + cache token. | Cần làm |
| **Logging chuẩn (Winston / Pino)** | Chưa có structured logging. | Cần làm |
| **Monitoring / Error Tracking (Sentry)** | Chưa có. | Cần làm |
| **CI/CD pipeline (GitHub Actions)** | Chưa có `.github/workflows`. | Cần làm |
| **Backup DB tự động** | Cần config trên Supabase hoặc cron job. | Cần làm |

---

## 🚫 LOẠI BỎ KHỎI SCOPE — Không cần thiết

| Hạng mục | Lý do loại bỏ |
|---|---|
| **Happy Hour / Flash Sale** | Không phù hợp với mô hình vận hành của khách hàng mục tiêu |
| **Combo ưu đãi** | Không cần thiết — chủ quán tự tạo món combo mới với giá riêng |
| **Khuyến mãi theo từng món** | Không cần thiết |
| **Split Bill** | Không cần thiết |
| **Partial Payment** | Không cần thiết |
| **Birthday Voucher tự động** | Không cần thiết |
| **Ưu đãi cá nhân hóa theo khách** | Không cần thiết |
| **Modifier Groups UI** | Chủ quán tự tạo món mới thay vì chọn size — không ai dùng flow này |

---

## ⏳ PHASE 2 — Để sau (chưa ưu tiên)

### AI & Tích hợp
| Hạng mục | Mô tả |
|---|---|
| **AI gợi ý combo / upsell** | Khi khách order, AI suggest thêm món phù hợp |
| **AI dự báo nguyên liệu** | Phân tích xu hướng bán → dự báo cần nhập bao nhiêu |
| **API Key system** | Tạo / quản lý API key để tích hợp POS/ERP/CRM bên ngoài |
| **Webhook system** | Gửi event (order.created, payment.done...) ra hệ thống bên ngoài |
| **Notification Push / Zalo OA** | Gửi thông báo đến khách hàng qua Zalo hoặc push notification |

### Local / On-premise
| Hạng mục | Mô tả |
|---|---|
| **Offline mode (Service Worker)** | Hệ thống hoạt động khi mất mạng, queue lại sau |
| **Cloud ↔ Local sync** | Cơ chế đồng bộ dữ liệu giữa server local và cloud |

---

## 📊 Tiến độ Phase 1 (Đã Hoàn Thành 100%)

| Nhóm | % Hoàn thành | Ghi chú |
|---|---|---|
| Nền tảng & Auth | 100% ✅ | Full JWT, RBAC, Tenant & Branch Isolation, Refresh Token Rotation |
| Menu Management | 100% ✅ | Full CRUD, Tùy chọn Size & Topping đồ uống, Category, Branch Override |
| Bàn + QR + Session | 100% ✅ | Sơ đồ bàn, Nhúng Logo Tenant vào QR Code, Session Management |
| Order Flow + Realtime | 100% ✅ | Realtime Socket.IO, Giỏ hàng QR menu, POS gọi món |
| KDS + POS | 100% ✅ | Realtime KDS, Duyệt order, Chuyển khoản VietQR (SePay), In hóa đơn |
| Voucher & Loyalty | 100% ✅ | Voucher chi nhánh, Tích điểm thành viên, Phân hạng Membership |
| Inventory / BOM | 100% ✅ | Định mức nguyên liệu BOM, Xuất nhập kho, Cảnh báo tồn kho |
| Analytics & Dashboard | 100% ✅ | Doanh thu, Z-Report, Hiệu suất nhân viên, Báo cáo theo kỳ |
| Branding & UX | 100% ✅ | Upload Logo, Banner & Background QR menu, Đa ngôn ngữ (i18n VI/EN) |
| Platform Admin UI | 100% ✅ | Quản lý Tenant, Subscription Invoice UI, Audit Logs UI, Onboarding Flow |
| Production Hardening | 100% ✅ | Helmet, Rate Limiting, Zod Validation, Winston Logging, Sentry, Redis, CI/CD, DB Backup Script |

