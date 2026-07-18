# HiAI-MenuGo – Project Status (Chính xác)

> Cập nhật lần cuối: 2026-07-18
> Stack: Next.js + TypeScript + Tailwind (Frontend) | Express + Prisma + PostgreSQL (Backend) | Socket.IO (Realtime)

---

## Ghi chú quan trọng

> **Dự án có 2 file schema Prisma khác nhau:**
> - `backend/prisma/schema.prisma` — **ĐẦY ĐỦ** (627 dòng, có Billing/Subscription)
> - `frontend/prisma/schema.prisma` — **THIẾU** (482 dòng, không có Billing, thiếu nhiều model)
>
> Backend schema là schema chính thức của hệ thống.

---

## 1. ✅ Đã hoàn chỉnh

### Database Schema (backend/prisma/schema.prisma)

| Nhóm | Models | Trạng thái |
|---|---|---|
| **SaaS Core** | `Tenant`, `Branch`, `TenantUser`, `CustomRole`, `Permission`, `RolePermission` | ✅ Đầy đủ |
| **Auth** | `User` (email, phone, passwordHash, role, domain) | ✅ Đầy đủ |
| **Branding** | `TenantBranding` (logo, primaryColor, secondaryColor) | ✅ Đầy đủ |
| **Menu** | `Category`, `MenuItem`, `BranchCategory`, `BranchMenuItem` | ✅ Đầy đủ |
| **Bàn & Phiên** | `Table` (7 trạng thái), `TableSession` (orderNo, version, lockedAt) | ✅ Đầy đủ |
| **Đơn hàng** | `OrderItem` (6 trạng thái: CART → PENDING → PREPARING → DONE → DELIVERED → VOID) | ✅ Đầy đủ |
| **Kho NVL** | `Ingredient`, `BOM`, `BranchIngredient` (inUseStock, importPrice, lowStockThreshold), `InventoryLog` | ✅ Đầy đủ |
| **Thanh toán** | `Payment` (status: PENDING/SUCCESS/FAILED, provider, paymentCode, transactionId) | ✅ Đầy đủ |
| **Ngân hàng** | `TenantBankAccount` (bankId, bankName, accountNumber, accountName, isDefault, per-branch) | ✅ Đầy đủ |
| **Voucher** | `Voucher`, `VoucherBranch` (per-branch applicability) | ✅ Đầy đủ |
| **Ca làm việc** | `Shift` (openFloat, closeFloat, cashTotal, transferTotal) | ✅ Đầy đủ |
| **Audit** | `AuditLog` (action, entity, entityId, details as JSON) | ✅ Đầy đủ |
| **System** | `SystemConfig` (geofence, maxOrderDistance) | ✅ Đầy đủ |
| **SaaS Billing** | `SubscriptionPlan`, `PlanFeature`, `UsageLimit`, `TenantSubscription`, `SubscriptionInvoice`, `SubscriptionPayment` | ✅ Đầy đủ |

---

### Backend – Services & Controllers

| Module | Files chính | Ghi chú |
|---|---|---|
| **Auth** | `auth.controller.ts`, `auth.service.ts`, `auth.middleware.ts` | Đăng nhập, JWT, refresh token, RBAC |
| **Platform Admin** | `platform-admin.controller.ts`, `platform-admin.service.ts` | Tạo/sửa/khóa/kích hoạt tenant, gán plan, xem audit logs, enforce branch limits |
| **Menu Admin** | `admin.menu.controller.ts`, `admin.category.controller.ts` | CRUD món ăn (kèm upload ảnh Cloudinary + rollback), CRUD danh mục |
| **Sold-Out** | `sold-out.controller.ts` | Toggle hết món realtime (Socket + Next.js ISR revalidation) |
| **Public QR Menu** | `menu.controller.ts`, `menu.service.ts` | Khách xem menu không cần đăng nhập |
| **Quản lý Bàn** | `table.controller.ts`, `table.service.ts` | CRUD bàn, cập nhật trạng thái, check usage limit |
| **Session** | `session.controller.ts`, `session.service.ts` | Join session (QR hoặc POS), thêm/xóa giỏ hàng, đóng session (OCC check via version + clientTimestamp) |
| **KDS** | `kds.controller.ts`, `kds.service.ts` | Lấy tickets bếp, cập nhật trạng thái item/toàn order, void từ bếp, giao món (DELIVERED), merge qty thông minh |
| **Cashier / POS** | `cashier.controller.ts`, `cashier.service.ts` | Tổng quan bàn, xem chi tiết đơn, duyệt đơn (approve), void item + hoàn kho tự động |
| **Thanh toán CASH** | `payment/providers/cash.provider.ts` | Thanh toán tiền mặt, SUCCESS ngay |
| **Thanh toán VietQR** | `payment/providers/vietqr.provider.ts` | Tạo QR động (`img.vietqr.io`), trạng thái PENDING, cashier confirm thủ công |
| **Confirm Payment** | `payment.service.ts` → `confirmManualPayment` | Cashier xác nhận đã nhận tiền → đóng session, trừ kho, emit socket |
| **Payment Factory** | `payment/payment.factory.ts` | Design pattern cho CASH, VIETQR (chuẩn bị MOMO, ZALOPAY, VNPAY) |
| **Voucher** | `voucher.controller.ts`, `voucher.service.ts` | CRUD voucher, validate (kiểm tra hạn, số lượt, branch), áp dụng khi thanh toán |
| **Inventory / BOM** | `ingredient.controller.ts`, `ingredient.service.ts`, `inventory.service.ts` | Nhập kho, xuất kho, auto-deduction theo BOM khi thanh toán, reverse khi void, cảnh báo low stock |
| **Z-Report** | `z-report.controller.ts`, `z-report.service.ts` | Báo cáo cuối ca: tổng doanh thu, cash vs transfer, số đơn |
| **Analytics** | `analytics.controller.ts`, `analytics.service.ts` | Revenue (group by day/week/month), peak hours, top selling, today overview, export Excel |
| **Tài khoản ngân hàng** | `bank.controller.ts` | CRUD tài khoản ngân hàng (per-tenant, per-branch, isDefault) |
| **Chi nhánh** | `branch.controller.ts`, `branch.service.ts` | CRUD branch |
| **Quản lý User** | `admin.user.controller.ts` | CRUD nhân viên (API đầy đủ) |
| **Feature Guard** | `middlewares/feature.guard.ts` | Kiểm tra plan hiện tại có cho phép feature hay không |
| **Usage Limit** | `services/usage-limit.service.ts` | Giới hạn tài nguyên theo plan (BRANCH, TABLE, USER, MENU_ITEM) |
| **Cleanup Job** | `services/cleanup.service.ts` | Tự động xóa dữ liệu >95 ngày, chạy mỗi 24h |
| **Seed SaaS** | `scripts/seed-saas.ts` | 3 gói: Starter (0đ) / Professional (499k) / Enterprise (1.499k) |
| **Socket.IO** | `socket/index.ts`, `socket/events.ts`, `socket/emit.helpers.ts` | 14 event types, 7 room types (tenant:branch isolated), auth-required rooms |
| **Email** | `services/email.service.ts` | Gửi email |
| **PDF / Excel** | `services/pdf.service.ts`, `services/excel.service.ts` | Xuất báo cáo |
| **Upload** | `middlewares/upload.middleware.ts` | Upload ảnh qua Cloudinary |
| **Geofence** | `SystemConfig` + `session.controller.ts` | Kiểm tra khoảng cách khách hàng đến quán |

---

### Frontend – Pages

| Trang | Path | Ghi chú |
|---|---|---|
| Đăng nhập | `app/login/` | Đầy đủ |
| Chọn chi nhánh | `app/branch-select/` | Đầy đủ |
| **QR Menu (khách)** | `app/table/` + `app/table/[tableId]/` | Menu công khai, đặt món, giỏ hàng, theo dõi trạng thái đơn hàng realtime |
| **KDS (bếp)** | `app/kds/` | Ticket view, cập nhật trạng thái, void, giao món |
| **Cashier / POS** | `app/pos/` + `app/pos/cashier/` | Sơ đồ bàn, duyệt đơn, thanh toán CASH/VietQR, void item |
| **Dashboard** | `app/admin/dashboard/` | Thống kê doanh thu, biểu đồ, top selling |
| **Quản lý Menu** | `app/admin/menu/` | CRUD món ăn + danh mục, upload ảnh |
| **Kho hàng** | `app/admin/inventory/` | Quản lý NVL, nhập/xuất kho, BOM |
| **Voucher** | `app/admin/vouchers/` | CRUD voucher, per-branch |
| **Z-Report** | `app/admin/z-report/` | Báo cáo cuối ca |
| **Tài khoản NH** | `app/admin/bank-account/` | Cấu hình tài khoản ngân hàng cho VietQR |
| **Phân quyền** | `app/admin/roles/` | RBAC: tạo role, gán permission |
| **Cài đặt** | `app/admin/settings/` | Cấu hình quán, geofence, tài khoản cá nhân, mật khẩu |
| **Platform Admin** | `app/platform-admin/` | Quản lý tenant, gán plan, activate/suspend |

### Frontend – Components & Hooks

| Component/Hook | Ghi chú |
|---|---|
| `components/floor/TableForm.tsx`, `TableModal.tsx`, `TableQRCode.tsx` | UI quản lý bàn + sinh QR Code |
| `components/cart/CartDrawer.tsx`, `CartItemRow.tsx` | Giỏ hàng khách |
| `components/kds/TicketCard.tsx` | KDS ticket card |
| `components/inventory/BomEditor.tsx`, `IngredientModal.tsx`, `StockAdjustModal.tsx` | Quản lý kho |
| `components/admin/AdminSidebar.tsx`, `AdminTabs.tsx` | Layout admin |
| `components/admin/settings/AccountModal.tsx`, `ResetPasswordModal.tsx`, `VoucherModal.tsx` | Settings modals |
| `components/auth/RoleGate.tsx`, `withRole.tsx` | Auth guard frontend |
| `hooks/useSocket.ts` | Socket.IO client hook |
| `hooks/useCartSync.ts` | Đồng bộ giỏ hàng realtime |
| `hooks/useAutoRefresh.ts` | Auto refresh data |
| `hooks/useRole.ts` | Kiểm tra role hiện tại |
| `stores/auth.store.ts` | Zustand auth state |
| `stores/cart.store.ts` | Zustand cart state (19KB — rất đầy đủ) |
| `app/actions/order.actions.ts` | Server actions cho order (12KB) |

---

## 2. ⚠️ Cần sửa / Cải thiện

### [🔴 SỬA NGAY] Đồng bộ schema frontend ← backend

**Vấn đề:** `frontend/prisma/schema.prisma` (483 dòng) bị **lạc hậu** so với `backend/prisma/schema.prisma` (628 dòng).

Frontend schema thiếu:
- `TenantBankAccount`
- `SubscriptionPlan`, `PlanFeature`, `UsageLimit`, `TenantSubscription`, `SubscriptionInvoice`, `SubscriptionPayment`
- `PaymentStatus` enum
- `OrderItemStatus.DELIVERED`
- `TableSession.orderNo`
- `User.phone`
- `Payment.status`, `Payment.paymentCode`, `Payment.provider`, `Payment.transactionId`
- `BranchIngredient.inUseStock`
- Nhiều `TableStatus` values mới (ORDERING, FOOD_READY, WAITING_PAYMENT, COMPLETED, DISABLED)

**Cách sửa:** Copy `backend/prisma/schema.prisma` sang `frontend/prisma/schema.prisma` hoặc dùng chung 1 file.

---

### [🟡 SỬA] Branding – Route mock, chưa implement thật

**Hiện tại:** `branding.routes.ts` trả response giả. Schema `TenantBranding` có rồi.

**Cần:**
- Service thật CRUD `TenantBranding`
- Upload logo → Cloudinary/Supabase
- API public GET branding cho QR Menu

---

### [🟡 SỬA] Membership / Loyalty – Route mock

**Hiện tại:** `membership.routes.ts` chỉ mock.

**Cần:**
- Schema: `Customer`, `LoyaltyTransaction`, `MembershipTier`
- Service tích điểm tự động sau thanh toán
- Frontend admin quản lý thành viên

---

### [🟡 SỬA] Integration API – Route mock

**Hiện tại:** `integration.routes.ts` chỉ mock.

**Cần:**
- `ApiKey` model + CRUD
- Auth middleware cho external API key
- Webhook outbound

---

### [🟡 SỬA] Split Bill – Chưa có

**Cần:**
- API tách hóa đơn theo món/theo người
- Sửa `Payment.sessionId @unique` → cho phép nhiều payment per session
- UI POS: nút tách hóa đơn

---

### [🟡 SỬA] Frontend thiếu trang Admin quản lý Nhân viên

API `admin.user.controller.ts` đầy đủ, nhưng frontend chưa có `/admin/users`.

---

## 3. ❌ Cần thêm mới

| Hạng mục | Ghi chú |
|---|---|
| **Staff / Waiter App** | Nhân viên phục vụ chưa có giao diện riêng (nhận thông báo mang món, "gọi nhân viên") |
| **Khuyến mãi nâng cao** | Happy Hour, Flash Sale, Combo ưu đãi, Upsell/Cross-sell |
| **Multi-language Menu** | Schema chỉ có 1 ngôn ngữ |
| **Cổng thanh toán mở rộng** | MOMO, ZALOPAY, VNPAY (đã có factory pattern sẵn sàng) |
| **Docker / On-premise** | Dockerfile, docker-compose cho Enterprise local deployment |
| **AI Features** | Gợi ý món, dự báo NVL, dịch menu tự động (giai đoạn sau) |

---

## 4. Thứ tự ưu tiên

| Mức | Hạng mục | Lý do |
|---|---|---|
| 🔴 **P0** | Đồng bộ frontend schema ← backend schema | Frontend sẽ lỗi type nếu schema không khớp |
| 🟡 **P1** | Branding API thật | Enterprise cần |
| 🟡 **P1** | Membership schema + service | Hồ sơ sản phẩm yêu cầu |
| 🟡 **P1** | Frontend trang Admin Users | API có sẵn, chỉ thiếu UI |
| 🟡 **P2** | Split Bill | Hồ sơ sản phẩm yêu cầu |
| 🟡 **P2** | Staff / Waiter App | Hoàn thiện vòng vận hành |
| 🟡 **P2** | Khuyến mãi nâng cao | Tăng giá trị sản phẩm |
| 🟢 **P3** | Integration API thật | Enterprise |
| 🟢 **P3** | Multi-language Menu | Khách quốc tế |
| 🟢 **P3** | MOMO / ZALOPAY / VNPAY | Mở rộng thanh toán |
| 🟢 **P4** | Docker / On-premise | Enterprise local |
| 🟢 **P4** | AI Features | Giai đoạn tiếp theo |
