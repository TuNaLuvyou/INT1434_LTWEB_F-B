# 🧹 Refactor & Cleanup — Frontend UI

> **Nhánh:** `refactor/cleanup` → `optimize`
> **Repo:** `hiai-go-menu/gm-ui`
> **Link tạo PR:** https://github.com/hiai-go-menu/gm-ui/pull/new/refactor/cleanup

---

## 📌 Tóm tắt

Xóa code lặp, gom API layer dùng chung và dọn dẹp frontend mà **không đổi UX**. Giao diện, luồng nghiệp vụ giữ nguyên.

**Net: −578 dòng** (15 file thay đổi)

---

## ✨ Thay đổi chính

### 1. Gộp logic giỏ hàng — `stores/cart.store.ts` (lớn nhất)
- 4 method `addItem` / `removeItem` / `updateQty` / `updateNote` mỗi method lặp lại ~40 dòng xử lý lỗi giống hệt nhau (409 conflict thiết bị khác, 423 bàn bị khóa, phiên kết thúc, sync lại giỏ từ server).
- Giờ gộp vào helper dùng chung **`runCartMutation(previousItems, buildRequest, logLabel, fallbackError, detectSessionClosed)`** — mỗi method chỉ còn giữ phần optimistic update + mô tả request của riêng nó.
- Hành vi giữ nguyên 100%: cùng status code, cùng event `cart-locked` / `session-closed`, cùng rollback khi lỗi.

### 2. Gom API client dùng chung — `lib/api/client.ts` (mới)
- Trước đây 3 file `admin.ts`, `integrations.ts`, `platform-admin.ts` mỗi file tự khai báo lại `API_URL` + `getHeaders()` (đọc token từ cookie) + logic parse JSON.
- Giờ tạo **`lib/api/client.ts`** export: `API_URL`, `getHeaders()`, `safeFetchJson()` — 3 file kia chỉ import và dùng, không còn code trùng.

### 3. Helper decode JWT — `lib/auth/client.ts`
- `app/pos/page.tsx` + `CashierClient.tsx` decode token bằng `atob()` lặp **4 chỗ** → thêm **`decodeTokenPayload()`** (an toàn, bắt lỗi, xử lý base64url), dùng chung.

### 4. Fix lint use-before-declare — `app/admin/integrations/page.tsx`
- `useEffect` gọi `loadWebhooks()` / `loadApiKeys()` **trước** khi 2 hàm được khai báo (lỗi `Cannot access variable before it is declared`).
- Chuyển 2 hàm lên trước `useEffect` — sửa đúng lỗi, không đổi hành vi.

### 5. `.gitignore`
- Thêm `public/sw.js` + `public/workbox-*.js` — file **sinh ra tự động bởi next-pwa** lúc build, không nên commit.

---

## 🗂️ File thay đổi

| Nhóm | File |
|---|---|
| **Store** | `stores/cart.store.ts` |
| **API layer** | `lib/api/client.ts` *(mới)*, `lib/api/admin.ts`, `lib/api/integrations.ts`, `lib/api/platform-admin.ts` |
| **Auth** | `lib/auth/client.ts` |
| **POS** | `app/pos/page.tsx`, `app/pos/CashierClient.tsx`, `app/pos/ItemOptionsModal.tsx` |
| **Admin** | `app/admin/dashboard/page.tsx`, `app/admin/integrations/page.tsx`, `components/admin/RevenueTrendChart.tsx` *(mới)* |
| **Bàn / KDS** | `app/table/[tableId]/page.tsx`, `app/table/[tableId]/MenuItemList.tsx` |
| **Khác** | `.gitignore` |

---

## 🧪 Kiểm chứng

- ✅ `tsc --noEmit` — không lỗi
- ✅ `next build --webpack` — compile OK, 24 trang static generate thành công
- ✅ Không đổi UX: cart vẫn optimistic update + rollback; API trả về cùng shape

---

## 🚀 Cách test nhanh

```bash
cd frontend
npm run dev
```

1. **Giỏ hàng bàn (QR menu):** mở `/table/[tableId]?tenantId=...&branchId=...` → thêm/bớt/sửa ghi chú món → bật tab thứ 2 cùng bàn để kiểm tra sync realtime (409).
2. **POS:** mở `/pos` → chọn bàn, gọi món, thanh toán tiền mặt → kiểm tra in hóa đơn + bàn chuyển trạng thái.
3. **Integrations:** mở `/admin/integrations` → tab Webhooks & API Keys load dữ liệu bình thường (không còn lỗi TDZ).
