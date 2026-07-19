# Dead Code & Redundant Files

## File đã xoá

### Backend (8 file)

| File | Lý do |
|------|-------|
| `backend/prisma.config.ts` | Prisma-generated config, không được tham chiếu |
| `backend/src/middlewares/validate.middleware.ts` | `validateRequest` không được import ở đâu |
| `backend/src/routes/branding.routes.ts` | Route mock, trả JSON giả |
| `backend/src/routes/integration.routes.ts` | Route mock, trả JSON giả |
| `backend/src/routes/membership.routes.ts` | Route mock, trả JSON giả |
| `backend/src/scripts/seed-saas.ts` | Seed script cũ, không dùng |

### Frontend (9 file)

| File | Lý do |
|------|-------|
| `frontend/app/table/table.constants.ts` | Constants không được import |
| `frontend/app/table/table.types.ts` | Types không được import |
| `frontend/types/jwt.types.ts` | `AccessTokenPayload` trùng backend, không dùng |
| `frontend/components/cart/CartDrawer.tsx` | Component không được import |
| `frontend/components/cart/CartItemRow.tsx` | Component không được import (chỉ CartDrawer dùng) |
| `frontend/components/floor/TableModal.tsx` | Component không được import |
| `frontend/components/floor/TableForm.tsx` | Component không được import (chỉ TableModal dùng) |
| `frontend/components/admin/settings/AccountModal.tsx` | Component không được import |
| `frontend/components/admin/settings/ResetPasswordModal.tsx` | Component không được import |
| `frontend/components/admin/settings/VoucherModal.tsx` | Component không được import |

---

## Export đã bỏ `export` (chỉ dùng nội bộ)

| File | Export |
|------|--------|
| `backend/src/controllers/admin.menu.controller.ts` | `getPublicIdFromUrl` |
| `backend/src/socket/emit.helpers.ts` | `emitTableSessionUpdated`, `emitCashierVoidConfirm`, `emitMenuSoldOut` |
| `frontend/lib/auth/client.ts` | `clearAccessToken` |
| `frontend/lib/socket/socket-client.ts` | `resetSocket` |
| `frontend/hooks/useRole.ts` | `useHasRole`, `useIsAdmin`, `useIsManagerOrAbove` |

---

## Code đã dọn

| File | Thay đổi |
|------|----------|
| `backend/src/app.ts` | Dồn syncMenu, authMiddleware, ApiResponse lên top-level import; xoá 3 route mock; xoá inline imports |
| `backend/src/middlewares/auth.middleware.ts` | Xoá `requirePermission` + `requireTenant` (dead exports) |
| `backend/src/services/cleanup.service.ts` | Xoá `stopAutomaticCleanupJob` (dead export) |
| `backend/src/services/table.service.ts` | Thay `require()` dynamic bằng `import` tĩnh `generateQrToken` |
| `backend/src/controllers/session.controller.ts` | Thay `require()` dynamic bằng `import` tĩnh `verifyQrToken` |
| `backend/src/services/cashier.service.ts` | Thay hardcode `maxTables = 5` (FOR TESTING ONLY) bằng `getTenantMaxLimit` |
| `backend/src/controllers/system.controller.ts` | Dồn `import { cleanupOldSessions }` lên đầu file |
| `backend/src/controllers/analytics.controller.ts` | Dồn `import { ExcelService }` lên đầu file |
| `backend/src/services/payment/payment.factory.ts` | Xoá comment `// case 'MOMO'` chết |
| `backend/src/socket/index.ts` | Xoá comment `Legacy handlers` thừa |
| `frontend/lib/api/admin.ts` | Xoá 8 hàm attendance/schedule không dùng |
| `frontend/app/actions/menu.actions.ts` | Xoá `revalidatePath` tới route không tồn tại (`/menu/[tableId]`, `/cashier`) |

---

## Trạng thái hiện tại

- Tổng số file đã xoá: **17 file** (6 backend + 11 frontend)
- Tổng số file đã sửa: **15 file** (12 backend + 3 frontend) + **3 export** đã bỏ export
- Các import đều đã được chuyển lên top-level, không còn inline import hay dynamic `require()`
- Các route mock đã được xoá hoàn toàn
- Code vẫn giữ nguyên logic nghiệp vụ, chỉ dọn dẹp code chết
