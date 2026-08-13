# 🔧 Refactor & Cleanup — Backend API

> **Nhánh:** `refactor/cleanup` → `optimize`
> **Repo:** `hiai-go-menu/gm-api`
> **Link tạo PR:** https://github.com/hiai-go-menu/gm-api/pull/new/refactor/cleanup

---

## 📌 Tóm tắt

Xóa code lặp, giảm độ phức tạp và dọn dẹp backend mà **không thay đổi hành vi API**. Toàn bộ endpoint giữ nguyên contract; chỉ tái cấu trúc nội bộ.

**Net: −224 dòng** (26 file thay đổi, 493 thêm / 224 xóa)

---

## ✨ Thay đổi chính

### 1. Gộp logic phát socket + webhook sau thanh toán
**`services/payment.service.ts`**

- Trước đây `processPayment()` và `confirmManualPayment()` lặp lại ~100 dòng gần giống nhau (emit `session:closed`, `table:status-changed`, webhook `payment:completed`, gửi ticket bếp KDS).
- Giờ gộp vào hàm dùng chung **`emitPaymentCompletion()`** — cả 2 luồng (CASH trả ngay / VIETQR xác nhận sau) gọi chung 1 chỗ.
- Giảm rủi ro lệch payload giữa 2 luồng.

### 2. Helper sinh mã đơn hàng
**`services/session.service.ts`**

- Thêm **`generateOrderNo(branchName)`** dùng chung cho `createTakeawaySession()` và `joinOrCreateSession()` (trước lặp 2 lần cùng logic lấy chữ cái đầu chi nhánh + giờ:phút:giây + số ngẫu nhiên).

### 3. Helper build URL VietQR
**`utils/vietqr.ts` (mới)**

- Chuỗi `https://img.vietqr.io/image/...` được build **lặp ở 5 chỗ** (VietQrProvider, cashier.service ×2, session.controller ×2) → gộp vào **`buildVietQrUrl()`**.
- Đảm bảo encode nhất quán (`paymentCode`, `accountName`).

### 4. Gộp 2 middleware API Key
**`middlewares/apiKey.guard.ts`**

- `apiKeyGuard` và `optionalApiKeyGuard` giống nhau 95% → gộp 1 hàm **`verifyApiKeyHeader(req, res, next, required)`**, 2 export cũ giữ nguyên tên nên **không cần sửa route nào**.

### 5. Sửa log kép timestamp
**`app.ts`**

- Trước đây `app.ts` override `console.log` thêm prefix `[HH:mm:ss]` **trong khi** `logger.ts` đã format timestamp → mỗi dòng log bị 2 timestamp (`[09:10:45] [2026-08-13 09:10:45] ...`).
- Bỏ override, HTTP request logger chuyển sang `logger.info('HTTP', ...)` — log sạch, 1 định dạng duy nhất.

---

## 🗂️ File thay đổi

| Nhóm | File |
|---|---|
| **Services** | `payment.service.ts`, `session.service.ts`, `cashier.service.ts`, `analytics.service.ts`, `menu.service.ts`, `cleanup.service.ts`, `redis.ts` |
| **Controllers** | `session.controller.ts`, `analytics.controller.ts`, `branding.controller.ts`, `menu.controller.ts`, `sepay.controller.ts`, `sold-out.controller.ts` |
| **Middlewares** | `apiKey.guard.ts`, `auth.middleware.ts` |
| **Routes** | `analytics.routes.ts` |
| **Socket** | `socket/index.ts`, `emit.helpers.ts`, `handlers/*` |
| **Utils (mới)** | `utils/vietqr.ts`, `utils/logger.ts` |
| **Workers** | `workers/webhook.worker.ts` |

---

## 🧪 Kiểm chứng

- ✅ `tsc --noEmit` — không lỗi
- ✅ `npm run build` (prisma generate + tsc) — thành công
- ✅ Hành vi API không đổi (không sửa route/contract endpoint)

---

## 🚀 Cách test nhanh

```bash
cd backend
npm run dev
```

- Gọi `/api/payment/sessions/:id/pay` với method `CASH` → kiểm tra socket `session:closed`, `table:status-changed`, webhook `payment:completed`.
- Gọi `/api/sessions/:id/request-payment` method `VIETQR` → xác nhận bằng `/api/payment/:id/confirm` → kiểm tra ticket KDS + webhook.
- Quan sát log: mỗi dòng chỉ còn **1** timestamp, có prefix module (HTTP, Socket.io, emit...).
