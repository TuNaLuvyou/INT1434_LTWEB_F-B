# 📱 HiAI-MenuGo Frontend App

> **Giao diện người dùng đa nền tảng** cho hệ thống HiAI-MenuGo (Scan · Order · Pay)  
> Xây dựng trên **Next.js 15 (App Router)** và **React 18**, phục vụ 5 đối tượng người dùng: **Khách hàng gọi món tại bàn**, **Nhà bếp (KDS)**, **Thu ngân (POS)**, **Quản trị Nhà hàng (Admin)** và **Vận hành SaaS (Platform Admin)**.

---

## 🛠️ Công nghệ & Thư viện

| Nhóm | Thư viện |
|---|---|
| **Framework** | Next.js 15 (App Router), React 18, TypeScript |
| **Styling** | TailwindCSS (dark mode `bg-zinc-950` mặc định), PostCSS |
| **Font** | `Be Vietnam Pro` + `Geist Mono` + `Playfair Display` (Google Fonts) |
| **Icons** | Lucide React — bộ icon duy nhất, **không dùng Heroicons/FontAwesome** |
| **State** | Zustand — `useAuthStore`, `useCartStore` |
| **Realtime** | `socket.io-client` |
| **Toast** | `react-hot-toast` |
| **Charts** | Recharts (Dashboard analytics) |
| **QR Code** | `qrcode.react` (`QRCodeSVG`) |
| **i18n** | Custom `I18nProvider` (`context/i18nContext.tsx`) — vi/en |
| **Security** | `jose` — JWT verify trong Next.js middleware |
| **Print** | `react-to-print` |
| **Color Picker** | `react-colorful` (Branding settings) |

---

## 📂 Cấu trúc thư mục

```
frontend/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout: fonts, I18nProvider, AuthInit, Toaster
│   ├── page.tsx                      # Landing page / redirect logic
│   ├── globals.css                   # Global CSS + Tailwind directives
│   ├── login/                        # Trang đăng nhập nhân viên
│   ├── onboarding/                   # Wizard khởi tạo tenant mới
│   ├── branch-select/                # Chọn chi nhánh (ADMIN multi-branch)
│   ├── kds/
│   │   └── page.tsx                  # Kitchen Display System
│   ├── pos/
│   │   ├── page.tsx                  # POS main (sơ đồ bàn)
│   │   ├── CashierClient.tsx         # Component thu ngân chính
│   │   ├── ItemOptionsModal.tsx      # Modal tuỳ chọn món POS
│   │   └── cashier/page.tsx          # Cashier subview
│   ├── table/
│   │   ├── page.tsx                  # Redirect / entry
│   │   ├── hooks/useMenuSoldOut.ts   # Real-time sold-out tracking
│   │   └── [tableId]/
│   │       ├── page.tsx              # QR Menu entry page
│   │       ├── MenuItemList.tsx      # Toàn bộ giao diện khách gọi món + loyalty
│   │       ├── CustomerItemOptionsModal.tsx # Modal Size/Đường/Đá/Topping
│   │       ├── loading.tsx
│   │       └── error.tsx
│   ├── receipt/[sessionId]/
│   │   └── page.tsx                  # Trang xem & in hoá đơn (Public)
│   ├── admin/
│   │   ├── layout.tsx                # Admin layout với AdminSidebar
│   │   ├── page.tsx                  # Redirect → /admin/dashboard
│   │   ├── dashboard/page.tsx        # Dashboard doanh thu + biểu đồ
│   │   ├── menu/page.tsx             # Quản lý món ăn + danh mục
│   │   ├── inventory/page.tsx        # Kho nguyên liệu + BOM
│   │   ├── vouchers/
│   │   │   ├── page.tsx              # Voucher list + MembershipTab + MemberListTab
│   │   │   ├── MembershipTab.tsx     # Quản lý hạng thành viên
│   │   │   └── MemberListTab.tsx     # Danh sách & lịch sử điểm thành viên
│   │   ├── z-report/page.tsx         # Báo cáo cuối ca
│   │   ├── roles/page.tsx            # Phân quyền nhân viên
│   │   ├── audit-logs/page.tsx       # Lịch sử thao tác hệ thống
│   │   ├── invoices/page.tsx         # Hoá đơn SaaS subscription
│   │   ├── bank-account/page.tsx     # Tài khoản ngân hàng VietQR
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── SettingsClient.tsx    # Settings tabs: General + Branding + Bank
│   │       └── BrandingTab.tsx       # Tùy biến logo, màu, banner
│   ├── platform-admin/
│   │   ├── layout.tsx                # Layout riêng cho Platform Admin
│   │   ├── page.tsx
│   │   └── PlatformAdminClient.tsx   # Quản lý Tenants + gói dịch vụ
│   ├── actions/                      # Next.js Server Actions
│   └── api/                          # API Routes (revalidate cache, proxy)
│
├── components/
│   ├── admin/
│   │   └── AdminSidebar.tsx          # Sidebar chính: nav + language switcher + logout
│   ├── auth/
│   │   ├── AuthInit.tsx              # Khởi tạo auth state từ cookie
│   │   └── RoleGate.tsx             # Guard component theo role
│   ├── common/
│   │   └── LanguageSwitcher.tsx      # Toggle vi/en
│   ├── floor/
│   │   └── TableQRCode.tsx           # QR Code bàn với logo tenant (level H)
│   ├── inventory/
│   │   ├── BomEditor.tsx             # Chỉnh Bill of Materials
│   │   ├── IngredientModal.tsx       # Thêm/sửa nguyên liệu
│   │   └── StockAdjustModal.tsx      # Điều chỉnh tồn kho thủ công
│   ├── print/
│   │   ├── KitchenTicketTemplate.tsx # Phiếu chế biến bếp (in nhiệt)
│   │   └── ReceiptPrintTemplate.tsx  # Hoá đơn thanh toán (in nhiệt)
│   ├── CategoryFilter.tsx            # Bộ lọc danh mục
│   ├── CategoryManagerModal.tsx      # CRUD danh mục
│   ├── MenuCard.tsx                  # Card món ăn
│   ├── MenuItemForm.tsx              # Form thêm/sửa món (upload ảnh Cloudinary)
│   └── ToppingManagerModal.tsx       # Quản lý Modifier Groups (Topping)
│
├── context/
│   └── i18nContext.tsx               # I18nProvider + useI18n() hook
│
├── hooks/
│   ├── useSocket.ts                  # Socket.IO client, auto-reconnect
│   ├── useCartSync.ts                # Đồng bộ giỏ hàng real-time
│   ├── useAutoRefresh.ts             # Polling tự động làm mới dữ liệu
│   └── useRole.ts                    # Kiểm tra role hiện tại
│
├── lib/
│   ├── api/                          # API client helpers (fetch wrapper)
│   ├── auth/                         # Auth utilities (client-side)
│   ├── socket/                       # Socket client init
│   ├── options.ts                    # Fetch options helpers
│   └── prisma.ts                     # Prisma client (server-side)
│
├── stores/
│   ├── auth.store.ts                 # useAuthStore (Zustand)
│   └── cart.store.ts                 # useCartStore (Zustand)
│
├── types/                            # TypeScript interfaces & types
├── public/                           # Static assets
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 🔑 Cấu hình biến môi trường (`.env`)

```env
# 1. BACKEND API URL (REST + Socket.IO)
# Dùng 127.0.0.1 thay localhost để tránh lỗi IPv6/CORS
NEXT_PUBLIC_API_URL="http://127.0.0.1:5000"

# 2. DATABASE (dùng trong Server Components / Server Actions)
DATABASE_URL="postgresql://[user]:[pass]@[host]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://[user]:[pass]@[host]:5432/postgres"

# 3. AUTHENTICATION — Phải trùng với backend
JWT_ACCESS_SECRET="your_jwt_access_secret_here"
REVALIDATION_SECRET="your_revalidation_secret_here"

# 4. RESTAURANT CONFIG
NEXT_PUBLIC_RESTAURANT_NAME="HiAI-MenuGo"
```

---

## 🎯 Phân hệ Giao diện

### 1. 📲 Khách hàng — `/table/[tableId]` (Public)
- Quét QR tại bàn, gọi món không cần đăng nhập
- Tuỳ chọn Size / Đường / Đá / Topping (auto-detect đồ uống theo danh mục)
- Giỏ hàng đồng bộ real-time giữa tất cả người cùng bàn qua Socket.IO
- Xem lịch sử đơn, theo dõi trạng thái từng món real-time
- Yêu cầu thanh toán từ bàn
- **Geofencing:** Haversine algorithm — ngăn đặt món từ xa
- **Loyalty:** Nhập SĐT → hiển thị hạng thành viên + điểm, tuỳ chọn dùng điểm giảm giá

### 2. 💵 Thu ngân — `/pos` + `/pos/cashier`
- Sơ đồ bàn real-time (màu sắc theo trạng thái)
- Mở/đóng phiên bán hàng (Shift)
- Duyệt đơn từ bàn, lên đơn POS trực tiếp
- Thanh toán: Tiền mặt (tính tiền thừa) + VietQR (auto-confirm qua SePay)
- Áp dụng Voucher, điểm Loyalty
- Void món + hoàn kho tự động
- In hoá đơn nhiệt (ReceiptPrintTemplate)

### 3. 👨‍🍳 Bếp — `/kds`
- Nhận đơn mới real-time, âm thanh thông báo
- Chuyển trạng thái: `PENDING → PREPARING → DONE → DELIVERED`
- Đánh dấu hết/còn món ngay tại màn hình bếp
- In phiếu chế biến (KitchenTicketTemplate)

### 4. 📊 Quản trị — `/admin/*`
| Trang | Chức năng |
|---|---|
| `/admin/dashboard` | Dashboard doanh thu, biểu đồ Recharts, top món |
| `/admin/menu` | CRUD món ăn, danh mục, Modifier Groups, upload Cloudinary |
| `/admin/inventory` | Kho nguyên liệu, BOM, lịch sử điều chỉnh |
| `/admin/vouchers` | Voucher + Hạng thành viên + Danh sách member |
| `/admin/z-report` | Báo cáo cuối ca, xuất Excel/PDF, gửi email |
| `/admin/roles` | Phân quyền nhân viên (MANAGER/CASHIER/KITCHEN) |
| `/admin/audit-logs` | Lịch sử toàn bộ thao tác hệ thống |
| `/admin/invoices` | Hoá đơn subscription SaaS |
| `/admin/settings` | Cài đặt chung, Branding (logo/màu), Geofencing |
| `/admin/bank-account` | Tài khoản ngân hàng VietQR |

### 5. ☁️ Platform Admin — `/platform-admin`
- Quản lý toàn bộ Tenants (chuỗi nhà hàng)
- Gán gói dịch vụ (Starter / Professional / Enterprise)
- Xem Audit Logs và Invoices toàn hệ thống
- Cách ly hoàn toàn khỏi business data của tenant

---

## 🎨 UI/UX Design System

```
Nền:        bg-zinc-950 (dark mode mặc định)
Border:     border-zinc-800 / border-zinc-900
Card:       bg-zinc-900/40 border border-zinc-900 rounded-2xl
Glass:      backdrop-blur-sm bg-zinc-900/60
Gradient:   from-violet-400 to-indigo-400 (Admin UI)
POS:        blue-500 / blue-400
KDS:        green (DONE) / amber (PREPARING) / red (PENDING)
Branding:   primaryColor / secondaryColor từ API /api/branding (per-tenant)
```

> ⚠️ **Không hardcode màu trong QR Menu** — luôn đọc từ `primaryColor`/`secondaryColor` branding.

---

## 🚀 Cài đặt & Chạy

```bash
# 1. Cài dependencies
npm install

# 2. Cấu hình môi trường
cp .env.example .env

# 3. Dev server (port 3000)
npm run dev

# 4. Production build
npm run build && npm start
```

---

## 🔐 Quy tắc Import quan trọng

```typescript
// ✅ ĐÚNG — Import trực tiếp file
import { RoleGate } from '@/components/auth/RoleGate';
import AuthInit from '@/components/auth/AuthInit';

// ❌ SAI — Barrel import (không có index.ts trong thư mục auth)
import { RoleGate } from '@/components/auth';
```
