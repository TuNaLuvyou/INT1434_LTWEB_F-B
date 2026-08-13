# Agent Context – gm-api (Backend)

## Dự án
- **Tên:** HiAI-MenuGo – Backend API cho hệ thống quản lý nhà hàng SaaS
- **Stack:** Node.js, Express, Prisma ORM, PostgreSQL, Redis
- **Thư mục làm việc:** `d:\Code\DuAn\HiAI-MenuGo\gm-api`

---

## Quy tắc bắt buộc
1. **Không được tự ý `git push`** – phải hỏi user trước.
2. Chạy `npx prisma validate` nếu sửa `schema.prisma`.
3. Chạy `npx prisma generate` sau khi thay đổi model.
4. Không xóa migration đã có, chỉ tạo migration mới.

---

## Kiến trúc API
- Base URL: `http://localhost:5000`
- Auth: JWT Bearer token (`getAccessTokenFromCookie()` ở phía UI)
- Prefix routes: `/api/...`

### Các endpoint chính
| Route | Mô tả |
|-------|-------|
| `GET /api/system/config` | Lấy cấu hình hệ thống (geofence, lat/lng, ...) |
| `PUT /api/system/config` | Cập nhật cấu hình hệ thống |
| `GET /api/system/info` | Thông tin gói cước/tenant |
| `GET /api/branding` | Lấy thông tin thương hiệu (logo, màu, banner) |
| `PUT /api/branding` | Cập nhật branding |
| `POST /api/branding/logo` | Upload logo (AI tách nền) |
| `POST /api/branding/banner` | Upload banner |
| `POST /api/branding/background` | Upload hình nền |
| `GET /api/branches` | Danh sách chi nhánh |
| `PUT /api/branches/:id` | Cập nhật chi nhánh |
| `POST /api/admin/menu/sync` | Trigger ISR sync menu |
| `GET /api/webhooks` | Danh sách webhook |
| `POST /api/webhooks` | Tạo webhook mới |
| `POST /api/webhooks/:id/test` | Test gửi webhook |
| `GET /api/bank-accounts` | Danh sách tài khoản ngân hàng |

---

## Mô hình dữ liệu quan trọng (Prisma)
- **Tenant** – thông tin cửa hàng, gói cước, branding
- **Branch** – chi nhánh (name, address, tenantId)
- **SystemConfig** – geofence settings (isGeofenceEnabled, lat, lng, maxDistance)
- **MenuItem** – món ăn (name, price, image, categoryId, isActive)
- **Order** – đơn hàng POS/QR
- **Webhook** – URL + events đăng ký
- **ApiKey** – quản lý API key cho tích hợp bên ngoài

---

## Redis
- Dùng cho: Queue gửi webhook (Bull), cache session/token
- Start Redis trước khi chạy API: `redis-server` hoặc service Windows
- Nếu thiếu Redis, webhook queue sẽ lỗi nhưng API vẫn chạy

---

## Git workflow
- Nhánh chính làm việc: `dev`
- Remote: `origin` → repo gm-api
- Quy trình: sửa → commit → **hỏi user** → push/PR
- **Không tự push khi chưa có lệnh từ user**
