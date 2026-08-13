# HiAI-MenuGo — Agent Rules & Project Context

> Tài liệu này định nghĩa các quy tắc bắt buộc, kiến trúc kỹ thuật, và knowledge base mà AI Agent PHẢI tuân theo khi làm việc trong workspace này.

---

## 1. Tech Stack & Kiến Trúc

### Frontend (`/frontend`)
- **Framework:** Next.js 15+ (App Router), React 18
- **Styling:** TailwindCSS (dark mode mặc định `bg-zinc-950`)
- **State:** Zustand — `useAuthStore` (`stores/auth.store.ts`), `useCartStore` (`stores/cart.store.ts`)
- **UI Kit:** Lucide Icons only — không dùng Heroicons hay FontAwesome
- **Font:** `Be Vietnam Pro` + `Geist Mono` + `Playfair Display` — khai báo trong `app/layout.tsx`
- **i18n:** `I18nProvider` từ `context/i18nContext.tsx` — wraps toàn bộ app, dùng `useI18n()` hook
- **Toast:** `react-hot-toast` — Toaster khai báo trong `app/layout.tsx`
- **Charts:** Recharts (dùng trong dashboard)
- **QR Code:** `qrcode.react` (`QRCodeSVG`)
- **Socket Client:** `socket.io-client`

### Backend (`/backend`)
- **Runtime:** Node.js + Express 5, TypeScript
- **ORM:** Prisma 6 + PostgreSQL (pg adapter) — schema tại `prisma/schema.prisma` (~27KB)
- **Auth:** JWT Access Token (15 phút) + Refresh Token (7 ngày, HttpOnly cookie) — rotation + reuse detection
- **Realtime:** Socket.IO — cùng HTTP server với Express, không dùng port riêng (`src/socket/index.ts`)
- **Logging:** Winston (`src/utils/logger.ts`) — structured JSON, lưu vào `logs/combined.log` & `logs/error.log`
- **Cache:** `ioredis` (`src/config/redis.ts`) — kết nối tự động nếu có `REDIS_URL`, fallback an toàn nếu không có
- **Security:** `helmet` + `express-rate-limit` (2000 req/15 phút) + Zod validation
- **Error Tracking:** `@sentry/node` + `@sentry/profiling-node` — init trong `app.ts`, enable khi có `SENTRY_DSN`
- **Upload:** Cloudinary (`src/config/cloudinary.ts`) via `multer-storage-cloudinary`
- **Email:** Nodemailer (`src/services/email.service.ts`)
- **PDF:** PDFKit (`src/services/pdf.service.ts`)
- **Excel:** ExcelJS (`src/services/excel.service.ts`)
- **Cleanup:** `src/services/cleanup.service.ts` — tự động dọn lịch sử > 90 ngày, chạy khi khởi động server
- **Webhook:** SePay webhook (`/api/webhooks/sepay`) — xác nhận thanh toán tự động

### Payment Factory Pattern
- `src/services/payment/payment-provider.interface.ts` — interface chung
- `src/services/payment/payment.factory.ts` — factory tạo provider theo method
- `src/services/payment/providers/cash.provider.ts` — Tiền mặt
- `src/services/payment/providers/vietqr.provider.ts` — VietQR (tạo QR động)

### Git & Deployment
- Frontend và backend là **hai Git repository riêng biệt** — chạy git commands trong đúng thư mục
- CI/CD: `.github/workflows/ci.yml` (GitHub Actions)
- **Không tự ý `git push`** — chỉ commit local, chờ user xác nhận trước khi push
- Backend port mặc định: **5000**; Frontend: **3000**

---

## 2. Multi-Tenant RBAC (CRITICAL — Không bao giờ bỏ qua)

Đây là hệ thống **SaaS multi-tenant**. Data isolation là yêu cầu bảo mật số 1.

| Role | Scope | Giới hạn truy cập |
|---|---|---|
| `PLATFORM_ADMIN` | SaaS Operator | Chỉ `/api/platform-admin/*` và `/platform-admin` frontend. **ZERO ACCESS** vào business data của tenant (orders, revenue, Z-Report, KDS, POS) |
| `ADMIN` | Tenant Owner | Toàn bộ chi nhánh trong `tenantId`. Query có thể filter `branchId` hoặc bỏ qua để aggregate |
| `MANAGER` | Branch Manager | Chỉ được phép thao tác với `branchId` của mình. **LUÔN** append `branchId: req.user.branchId` vào query |
| `KITCHEN` | Bếp / Pha chế | Giới hạn trong KDS routes + sold-out toggle, không truy cập thanh toán |
| `CASHIER` | Thu ngân | Giới hạn trong POS / Cashier routes + inventory reverse (hoàn kho) |

**Quy tắc bắt buộc khi viết API:**
```typescript
// ĐÚNG — Luôn có tenantId
prisma.menuItem.findMany({
  where: { tenantId: req.user.tenantId, branchId: req.user.branchId }
})

// SAI — Thiếu tenantId → lỗ hổng bảo mật
prisma.menuItem.findMany({ where: { branchId: req.user.branchId } })
```

---

## 3. Database & Prisma Conventions

- **Tenant Isolation:** Luôn include `tenantId: req.user.tenantId` trong mọi Prisma `where` clause khi query business entities (Orders, MenuItems, Payments, Shifts, Ingredients...)
- **Raw SQL:** Dùng `$queryRawUnsafe` phải dùng parameterized inputs (`$1`, `$2`) — không bao giờ interpolate string trực tiếp
- **Schema sync:** Sau khi sửa `schema.prisma` phải chạy `npx prisma format` rồi `npx prisma generate` trước khi dev/build
- **Migration:** Dùng `npx prisma migrate dev` cho local dev, `npx prisma migrate deploy` cho production
- **Seed:** `prisma/seed.ts` — chạy bằng `npm run db:seed` để tạo dữ liệu mẫu

### Các Model quan trọng
```
Tenant isolation chain:
  Tenant → Branch → TenantUser → OrderSession → Order → OrderItem

Auth:
  RefreshToken { token, userId, tenantId, branchId, isRevoked, family }
  — rotation + reuse detection

Branding:
  TenantBranding { logoUrl, primaryColor, secondaryColor, bannerUrl, backgroundUrl }
  — dùng `primaryColor`/`secondaryColor` trong toàn bộ QR menu UI

Menu:
  MenuItem { category: Category | string } — category có thể là object
  ModifierGroup { items[], prices[] } — Size/Topping, lưu localStorage trên FE

Loyalty:
  Customer { phone, points, membershipTierId }
  MembershipTier { name, color, discountPercent, minPoints }

Analytics:
  AuditLog — UI tại /admin/audit-logs
  SubscriptionInvoice + SubscriptionPayment — UI tại /admin/invoices

Kho:
  Ingredient + BOM (Bill of Materials) — tự động trừ kho khi bán hàng
  InventoryLog — lịch sử điều chỉnh kho
```

---

## 4. Patterns Đã Thiết Lập (Không tự ý thay đổi)

### API Response Format
```typescript
// LUÔN dùng ApiResponse helper từ src/utils/response.ts
ApiResponse.success(res, data, 'Message');
ApiResponse.error(res, 'ERROR_CODE', 'message', statusCode);

// Format chuẩn:
// { "success": true, "data": {...}, "message": "..." }
// { "success": false, "message": "..." }
```

### Auth Middleware
```typescript
// Dùng trong routes (src/middlewares/auth.middleware.ts)
router.get('/route', authMiddleware, requireRole(['ADMIN', 'MANAGER']), controller);

// req.user sẽ có: userId, tenantId, branchId, role, permissions
```

### Feature Guard
```typescript
// Kiểm tra giới hạn gói dịch vụ (src/middlewares/feature.guard.ts)
router.post('/tables', authMiddleware, checkFeature('tables'), controller);
```

### Validation Pattern (Zod)
```typescript
import { validateBody } from '../middlewares/validate.middleware';
const schema = z.object({ name: z.string().min(1), price: z.number().positive() });
router.post('/', authMiddleware, validateBody(schema), controller);
```

### Socket.IO — Emit Helpers
Realtime được init trong `src/socket/index.ts`. Dùng `src/socket/emit.helpers.ts` để emit.
Handlers: `src/socket/handlers/floor.handler.ts`, `src/socket/handlers/kitchen.handler.ts`.

**Events chuẩn theo file `src/socket/events.ts`:**
- `order:new`, `order:updated`, `order:item:status`, `order:voided` — KDS/Order
- `session:updated`, `session:closed` — Phiên bán hàng
- `table:status-changed` — Sơ đồ bàn
- `sold_out:updated` — Hết món
- `payment:pending`, `payment:completed` — Thanh toán
- `cart:updated` — Giỏ hàng khách
- `inventory:updated` — Kho nguyên liệu

---

## 5. Frontend Patterns

### i18n (Đa ngôn ngữ)
```typescript
// Trong bất kỳ component nào:
import { useI18n } from '@/context/i18nContext';
const { t, locale, setLocale } = useI18n();
// t('dashboard') → 'Tổng quan' (vi) hoặc 'Dashboard' (en)

// Thêm key mới vào: frontend/context/i18nContext.tsx → translations object
```

### Branding Colors (primaryColor / secondaryColor)
```typescript
// Load từ API /api/branding
// Dùng trong inline styles:
style={{ borderColor: primaryColor, color: primaryColor }}
// Không hardcode màu — luôn dùng biến từ branding store/state
```

### Food vs Drink Detection
```typescript
// item.category có thể là string HOẶC object { id, name }
// Luôn extract an toàn:
const catRaw = item.category || '';
const catName = typeof catRaw === 'string' ? catRaw : (catRaw as any)?.name || '';
const isDrink = ['coffee','tea','drink','juice','boba','smoothie','soda']
  .some(k => catName.toLowerCase().includes(k));
// isDrink === true → hiện Size, Đường, Đá, Topping
// isDrink === false → chỉ hiện Ghi chú
```

### QR Code với Logo
```typescript
// Dùng QRCodeSVG từ 'qrcode.react' với imageSettings:
<QRCodeSVG
  value={menuUrl}
  level="H"  // BẮT BUỘC level H khi có logo (error correction cao hơn)
  imageSettings={logoUrl ? { src: logoUrl, width: 44, height: 44, excavate: true } : undefined}
/>
// Component: components/floor/TableQRCode.tsx
```

### AdminSidebar Language Switcher
- Đặt ở footer của `AdminSidebar.tsx` (`components/admin/AdminSidebar.tsx`)
- Dùng `LanguageSwitcher` component từ `components/common/LanguageSwitcher.tsx`

### Hooks quan trọng (frontend)
- `hooks/useSocket.ts` — quản lý Socket.IO client, auto-reconnect
- `hooks/useCartSync.ts` — đồng bộ giỏ hàng real-time
- `hooks/useAutoRefresh.ts` — tự động làm mới dữ liệu
- `hooks/useRole.ts` — kiểm tra role hiện tại
- `app/table/hooks/useMenuSoldOut.ts` — theo dõi món hết theo real-time

---

## 6. Feature Map — Routes & Files

### Backend Routes (25 route files)
| Route prefix | File | Quyền |
|---|---|---|
| `/api/auth/*` | `auth.routes.ts` | Public |
| `/api/menu/*` | `menu.routes.ts` | Public (QR menu) |
| `/api/tables/*` | `table.routes.ts` | ADMIN, MANAGER, CASHIER |
| `/api/sessions/*` | `session.routes.ts` | ADMIN, MANAGER, KITCHEN, CASHIER |
| `/api/ingredients/*` | `ingredient.routes.ts` | ADMIN, MANAGER |
| `/api/inventory/*` | `ingredient.routes.ts` (alias) + `reverseRouter` | ADMIN/MANAGER (logs) + CASHIER (reverse) |
| `/api/kds/*` | `kds.routes.ts` | KITCHEN, MANAGER, ADMIN |
| `/api/cashier/*` | `cashier.routes.ts` | CASHIER, MANAGER, ADMIN |
| `/api/analytics/*` | `analytics.routes.ts` | ADMIN, MANAGER |
| `/api/payment/*` | `payment.routes.ts` | CASHIER, MANAGER, ADMIN |
| `/api/vouchers/*` | `voucher.routes.ts` | ADMIN, MANAGER |
| `/api/z-report/*` | `z-report.routes.ts` | ADMIN, MANAGER |
| `/api/webhooks/sepay` | `sepay.routes.ts` | Public (webhook SePay) |
| `/api/admin/menu-items/*` | `admin.menu.routes.ts` + `sold-out.routes.ts` | ADMIN, MANAGER (+ KITCHEN cho sold-out) |
| `/api/admin/categories/*` | `admin.category.routes.ts` | ADMIN, MANAGER |
| `/api/admin/users/*` | `admin.user.routes.ts` | ADMIN |
| `/api/system/*` | `system.routes.ts` | ADMIN |
| `/api/platform-admin/*` | `platform-admin.routes.ts` | PLATFORM_ADMIN chỉ |
| `/api/banks/*` | `bank.routes.ts` | ADMIN |
| `/api/branches/*` | `branch.routes.ts` | ADMIN |
| `/api/customer/*` | `customer.routes.ts` | ADMIN, MANAGER, CASHIER |
| `/api/membership-tiers/*` | `membershipTier.routes.ts` | ADMIN |
| `/api/branding/*` | `branding.routes.ts` | ADMIN + Public GET |
| `/api/qr/*` | `qr-code.routes.ts` | ADMIN, MANAGER |
| `/api/employee-analytics/*` | `employee-analytics.routes.ts` | ADMIN, MANAGER |

### Frontend Pages
| Page | Route | File chính | Role |
|---|---|---|---|
| Home redirect | `/` | `app/page.tsx` | — |
| Login | `/login` | `app/login/` | Public |
| Onboarding | `/onboarding` | `app/onboarding/` | ADMIN mới |
| Branch Select | `/branch-select` | `app/branch-select/` | ADMIN |
| Dashboard | `/admin/dashboard` | `app/admin/dashboard/page.tsx` | ADMIN, MANAGER |
| Menu quản lý | `/admin/menu` | `app/admin/menu/page.tsx` | ADMIN, MANAGER |
| Nguyên liệu / Kho | `/admin/inventory` | `app/admin/inventory/page.tsx` | ADMIN, MANAGER |
| Voucher + Loyalty | `/admin/vouchers` | `app/admin/vouchers/page.tsx` + `MembershipTab.tsx` + `MemberListTab.tsx` | ADMIN, MANAGER |
| Z-Report | `/admin/z-report` | `app/admin/z-report/page.tsx` | ADMIN, MANAGER |
| Phân quyền nhân viên | `/admin/roles` | `app/admin/roles/page.tsx` | ADMIN |
| Audit Logs | `/admin/audit-logs` | `app/admin/audit-logs/page.tsx` | ADMIN, PLATFORM_ADMIN |
| Invoices | `/admin/invoices` | `app/admin/invoices/page.tsx` | ADMIN, PLATFORM_ADMIN |
| Settings (General + Branding + Bank) | `/admin/settings` | `app/admin/settings/` | ADMIN |
| Bank Account riêng | `/admin/bank-account` | `app/admin/bank-account/page.tsx` | ADMIN |
| Platform Admin | `/platform-admin` | `app/platform-admin/` | PLATFORM_ADMIN |
| KDS | `/kds` | `app/kds/page.tsx` | KITCHEN, MANAGER, ADMIN |
| POS / Cashier | `/pos` | `app/pos/page.tsx` + `CashierClient.tsx` | CASHIER, MANAGER, ADMIN |
| Cashier subview | `/pos/cashier` | `app/pos/cashier/page.tsx` | CASHIER, MANAGER, ADMIN |
| QR Menu khách | `/table/[tableId]` | `app/table/[tableId]/MenuItemList.tsx` | Public |
| Receipt | `/receipt/[sessionId]` | `app/receipt/[sessionId]/page.tsx` | Public |

### Frontend Components Quan Trọng
| Component | File | Mô tả |
|---|---|---|
| AdminSidebar | `components/admin/AdminSidebar.tsx` | Sidebar chính admin, có language switcher |
| RoleGate | `components/auth/RoleGate.tsx` | Guard component kiểm tra role |
| AuthInit | `components/auth/AuthInit.tsx` | Khởi tạo auth state |
| LanguageSwitcher | `components/common/LanguageSwitcher.tsx` | Switch vi/en |
| TableQRCode | `components/floor/TableQRCode.tsx` | QR Code với logo tenant |
| KitchenTicketTemplate | `components/print/KitchenTicketTemplate.tsx` | In phiếu bếp |
| ReceiptPrintTemplate | `components/print/ReceiptPrintTemplate.tsx` | In hoá đơn thanh toán |
| MenuItemForm | `components/MenuItemForm.tsx` | Form thêm/sửa món ăn |
| ToppingManagerModal | `components/ToppingManagerModal.tsx` | Quản lý topping |
| CategoryManagerModal | `components/CategoryManagerModal.tsx` | Quản lý danh mục |
| BomEditor | `components/inventory/BomEditor.tsx` | Chỉnh BOM nguyên liệu |
| IngredientModal | `components/inventory/IngredientModal.tsx` | Thêm/sửa nguyên liệu |
| StockAdjustModal | `components/inventory/StockAdjustModal.tsx` | Điều chỉnh tồn kho |
| CustomerItemOptionsModal | `app/table/[tableId]/CustomerItemOptionsModal.tsx` | Modal tuỳ chọn món (Size/Đường/Đá/Topping) |
| ItemOptionsModal | `app/pos/ItemOptionsModal.tsx` | Modal tuỳ chọn món trong POS |

---

## 7. UI/UX Design Standards

- **Màu nền default:** `bg-zinc-950` (dark mode)
- **Border:** `border-zinc-800` hoặc `border-zinc-900`
- **Card:** `bg-zinc-900/40 border border-zinc-900 rounded-2xl`
- **Glassmorphism:** `backdrop-blur-sm bg-zinc-900/60`
- **Gradient text:** `bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent`
- **Primary highlight:** Tùy tenant — đọc từ `primaryColor` branding
- **Admin UI:** Violet/indigo (`violet-500`, `indigo-400`)
- **POS UI:** Blue (`blue-500`, `blue-400`)
- **KDS UI:** Green/Amber/Red theo trạng thái (PENDING/PREPARING/DONE)
- **Icon set:** Lucide Icons only
- **Typography:** `Be Vietnam Pro` (khai báo trong `app/layout.tsx`) — không dùng font mặc định browser

### Mobile (QR Menu khách — `/table/[tableId]`)
- Modal tuỳ chọn: `h-full h-screen` trên mobile, `sm:h-auto sm:max-h-[85vh]` trên desktop
- `rounded-none sm:rounded-3xl`
- Body scroll lock khi modal mở: `document.body.style.overflow = "hidden"`
- Không có dual scrollbar: `scrollbar-none` trên content div

---

## 8. Phase Status

### Phase 1 — ✅ 100% Hoàn Thành
Toàn bộ các hạng mục Phase 1 đã được triển khai, build thành công 25 route files backend, 15+ frontend pages và đầy đủ components.

Xem chi tiết: [`PHASE1_TESTING_GUIDE.md`](../PHASE1_TESTING_GUIDE.md) và [`ROADMAP.md`](../ROADMAP.md)

### Phase 2 — Chưa bắt đầu
- AI gợi ý combo / upsell
- AI dự báo nguyên liệu
- API Key system & Webhook outbound
- Offline mode (Service Worker)
- Cloud ↔ Local sync
- Cổng thanh toán MOMO / ZaloPay / VNPAY (Factory đã sẵn sàng)
- Tách hoá đơn (Split Bill)

---

## 9. Agent Behavioral Rules

1. **Git Push Policy:** KHÔNG tự ý `git push`. Chỉ commit local, đợi user xác nhận mới push.
2. **Atomic Commits:** Mỗi feature/fix là 1 commit riêng với conventional message (`feat:`, `fix:`, `refactor:`, `docs:`).
3. **Code Preservation:** Không xoá features hoặc comments hiện có trừ khi được yêu cầu rõ ràng.
4. **Tenant Isolation:** KHÔNG BAO GIỜ bỏ `tenantId` trong Prisma query — đây là lỗ hổng bảo mật nghiêm trọng.
5. **PLATFORM_ADMIN Isolation:** PLATFORM_ADMIN không được truy cập business data của tenant (revenue, orders, KDS...).
6. **Schema Changes:** Khi sửa `schema.prisma` phải chạy `prisma format` + `prisma generate` + kiểm tra không có migration breaking change.
7. **Type Safety:** Luôn check `typeof` trước khi gọi `.toLowerCase()` trên `item.category` (có thể là object).
8. **No Hardcoded Colors:** Màu active/highlight trong QR menu và modal tuỳ chọn phải đọc từ `primaryColor`/`secondaryColor` branding, không hardcode.
9. **Import Paths:** Không dùng barrel `@/components/auth` — luôn import trực tiếp file, ví dụ `@/components/auth/RoleGate`.
10. **Port chuẩn:** Backend: 5000, Frontend: 3000. Không tự ý thay đổi.

---

## 10. Các Pattern UI Đã Thiết Lập (Không tự ý thay đổi)

### Note / Ghi Chú Tùy Chọn Món — Định Dạng Multi-line

**Áp dụng cho:** CashierClient.tsx, kds/page.tsx, KitchenTicketTemplate.tsx, ReceiptPrintTemplate.tsx

Chuỗi `item.note` từ backend chứa toàn bộ tùy chọn gộp lại với dấu `•` phân cách.
**KHÔNG bao giờ hiển thị nguyên chuỗi.** Luôn tách thành từng dòng riêng:

```tsx
// CashierClient / KDS — tách multi-line (màu cam/vàng):
{item.note
  .replace(/^📝?\s*Ghi chú:\s*/i, '')
  .split(/•|;|\||\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((line, idx) => (
    <div key={idx} className="flex items-start gap-1 leading-tight">
      <span className="text-orange-400/60 font-bold select-none">•</span>
      <span>{line}</span>
    </div>
  ))}

// Bill in (KitchenTicketTemplate / ReceiptPrintTemplate) — chữ đen nhỏ, không viền màu:
{item.note
  .replace(/^📝?\s*Ghi chú:\s*/i, '')
  .split(/•|;|\||\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((line, nIdx) => (
    <div key={nIdx} className="leading-tight">- {line}</div>
  ))}
```

**KDS Helper** — dùng helper `renderKdsNoteLines(noteStr, isLineThrough?)` trong `kds/page.tsx`:
```typescript
const renderKdsNoteLines = (noteStr?: string | null, isLineThrough = false) => { ... };
```

### Nút HUỶ MÓN trong CashierClient — Canh Phải

```tsx
// Nút huỷ món PHẢI canh phải (justify-end), không để bên trái:
<div className="mt-2.5 flex justify-end">
  <button className="... text-rose-400 border border-rose-500/20 ...">✕ HUỶ MÓN</button>
</div>
```

### Nút Thanh Toán QR Menu — Chống Giựt/Chớp

**Vấn đề:** Nút Thanh toán xuất hiện rồi biến mất trong chớp mắt khi dữ liệu `PENDING` từ Socket.IO chưa đồng bộ về.

**Giải pháp:** Thêm `!isInitializing` vào điều kiện render nút thanh toán:

```tsx
// frontend/app/table/[tableId]/MenuItemList.tsx
{cartTab === 'history' && !isInitializing && lastOrder && lastOrder.length > 0 && (
  <div>
    {!lastOrder.some(item => item.status === 'PENDING') && lastOrder.some(item => item.status !== 'VOID') && (
      <button ...>Thanh toán</button>
    )}
  </div>
)}
// KHÔNG thêm thông báo/banner chờ duyệt — chỉ ẩn nút khi còn PENDING
```

### Loyalty Form QR Menu — Màu Branding Động

**File:** `frontend/app/table/[tableId]/MenuItemList.tsx`

Form tích điểm (khung thông tin SĐT, số điểm, nút Xác nhận) PHẢI dùng `primaryColor`/`secondaryColor` từ branding.
Thẻ hạng thành viên (Hạng Vàng, Bạc...) giữ nguyên màu riêng theo `membershipTier.color`.

```tsx
// Khung container — màu branding nhạt:
style={{
  backgroundColor: `color-mix(in srgb, ${primaryColor} 6%, #ffffff)`,
  borderColor: `color-mix(in srgb, ${primaryColor} 20%, #e5e7eb)`,
}}

// Badge điểm — màu primaryColor:
<span style={{ backgroundColor: primaryColor }} className="text-white ...">
  {customerData.points} điểm
</span>

// Nút Xác nhận — gradient primaryColor → secondaryColor:
style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}

// Thẻ hạng — KHÔNG đổi, giữ nguyên membershipTier.color:
style={{ backgroundColor: customerData.membershipTier.color || '#ffd700' }}
```

### Badges Hạng + Điểm — Layout Side-by-Side

```tsx
// Hạng và điểm phải cùng 1 hàng flex, không flex-wrap:
<div className="flex items-center gap-2">
  {membershipTier && <span style={{ backgroundColor: membershipTier.color }}>Hạng X</span>}
  <span style={{ backgroundColor: primaryColor }}>XXX điểm</span>
</div>
```

---

## 11. Print Templates — Định Dạng Ghi Chú

| Template | File | Định dạng note |
|---|---|---|
| Phiếu chế biến | `components/print/KitchenTicketTemplate.tsx` | Chữ đen nhỏ `text-xs text-black`, dòng `- xxx`, **không** viền đỏ/icon ⚠️ |
| Hóa đơn thanh toán | `components/print/ReceiptPrintTemplate.tsx` | Chữ đen nhỏ `text-xs text-black`, dòng `- xxx`, dưới tên món |
