# Agent Context – gm-ui (Frontend)

## Dự án
- **Tên:** HiAI-MenuGo – Hệ thống quản lý nhà hàng SaaS (QR Order, KDS, POS, Admin)
- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS
- **Thư mục làm việc:** `d:\Code\DuAn\HiAI-MenuGo\gm-ui`

---

## Quy tắc bắt buộc
1. **Không được tự ý `git push`** – phải hỏi user trước.
2. Luôn chạy `npx tsc --noEmit` sau khi sửa file để kiểm tra lỗi TypeScript.
3. Commit trước khi merge branch.

---

## Design Language (Admin Suite)
Tất cả trang `/admin/*` tuân theo 1 ngôn ngữ thiết kế thống nhất:

### Header (Sticky)
```tsx
<header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 shrink-0">
  <div className="max-w-7xl mx-auto px-3 sm:px-6 pl-16 lg:pl-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-1">
        <Icon size={13} className="stroke-[2.5]" />
        <span>Hệ thống HiAI-MenuGo • Admin Panel</span>
      </div>
      <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
        Tiêu Đề Trang
      </h1>
    </div>
  </div>
</header>
```

### Layout chính (Main)
```tsx
<main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 max-w-7xl w-full mx-auto relative z-10 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
```
- `h-screen`, `flex flex-col`, `overflow-hidden` trên wrapper ngoài cùng
- `max-w-7xl mx-auto` cho cả header và main
- `pl-16 lg:pl-6` bù padding cho sidebar mobile/desktop

### Background Glow
```tsx
<div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
<div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[130px] pointer-events-none" />
```

### Tab bar
- Kiểu: **Pill tabs** – `rounded-xl`, `bg-violet-600/15`, `border border-violet-500/30`
- Không dùng `border-b-2` (underline tab) nữa
- Có `scrollbar-none overflow-x-auto` để responsive

### Scrollbar tùy chỉnh
- Toàn cục: `scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent` (đã có trong `globals.css`)
- Auto-hide: `scrollbar-auto-hide` (định nghĩa trong `globals.css`)

### Typography chuẩn
- Heading nội dung card: `text-base font-bold text-white`
- Mô tả sub: `text-xs text-zinc-400 font-light mt-0.5`
- Số liệu (stats): `font-mono text-base font-black`
- Badge label: `text-[10px] font-bold uppercase tracking-wider`

---

## Cấu trúc thư mục quan trọng
```
app/
  admin/
    bank-account/page.tsx  ← auto-hide scrollbar, sticky header
    menu/page.tsx           ← category tabs, sticky header
    roles/page.tsx          ← sticky header
    settings/
      SettingsClient.tsx    ← tab: geofence, sync, info, branches, branding
      BrandingTab.tsx       ← color picker, logo/banner/bg upload
    z-report/page.tsx       ← sticky header, scope switcher (ADMIN/MANAGER)
    webhook/page.tsx
  layout.tsx               ← I18nProvider > OfflineProvider > AuthInit
components/
  admin/
    AdminSidebar.tsx        ← NAV_ITEMS với i18n key
context/
  i18nContext.tsx          ← t('key') – dict: vi | en
globals.css                ← scrollbar utilities
```

---

## i18n (Context)
- Provider: `I18nProvider` bọc toàn bộ `layout.tsx`
- Dùng: `const { t } = useI18n()` trong client component
- Keys sidebar quan trọng: `dashboard`, `menu`, `inventory`, `voucher`, `zreport`, `integrations`, `roles`, `billing`, `settings`

---

## Git workflow
- Nhánh chính làm việc: `dev`
- Remote: `origin` → `https://github.com/hiai-go-menu/gm-ui.git`
- Quy trình: sửa → commit → **hỏi user** → push/PR
- **Không tự push khi chưa có lệnh từ user**
