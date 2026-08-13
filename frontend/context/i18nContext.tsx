'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Locale = 'vi' | 'en';

type Translations = Record<string, Record<Locale, string>>;

const translations: Translations = {
  // Navigation & General
  dashboard: { vi: 'Dashboard', en: 'Dashboard' },
  menuManagement: { vi: 'Quản lý Món ăn', en: 'Menu Items' },
  inventory: { vi: 'Nguyên liệu', en: 'Inventory & Materials' },
  vouchers: { vi: 'Khuyến mãi', en: 'Promotions & CRM' },
  zreport: { vi: 'Z-Report', en: 'Z-Reports' },
  integrations: { vi: 'Tích hợp & API', en: 'Integrations & API' },
  roles: { vi: 'Phân Quyền', en: 'Role Permissions' },
  bankAccount: { vi: 'Thanh Toán', en: 'Payment Settings' },
  auditLogs: { vi: 'Audit Logs', en: 'Audit Logs' },
  invoices: { vi: 'Hóa đơn', en: 'Invoices' },
  settings: { vi: 'Cài đặt hệ thống', en: 'System Settings' },
  backToApp: { vi: 'Quay lại App', en: 'Back to App' },
  logout: { vi: 'Đăng xuất', en: 'Logout' },

  // Settings Tabs
  geofencingTab: { vi: 'Định vị (Geofencing)', en: 'Geofencing' },
  syncTab: { vi: 'Đồng bộ thực đơn', en: 'Menu Sync' },
  infoTab: { vi: 'Thông tin phần mềm', en: 'System Info' },
  branchesTab: { vi: 'Chi nhánh', en: 'Branches' },
  brandingTab: { vi: 'Giao diện & Thương hiệu', en: 'Branding & Theme' },

  // Navigation Legacy Keys
  menu: { vi: 'Thực đơn', en: 'Menu' },
  tables: { vi: 'Sơ đồ bàn', en: 'Tables' },
  kds: { vi: 'Màn hình bếp', en: 'Kitchen (KDS)' },
  pos: { vi: 'Thu ngân / POS', en: 'Cashier / POS' },
  orders: { vi: 'Đơn hàng', en: 'Orders' },
  reports: { vi: 'Báo cáo', en: 'Reports' },
  employees: { vi: 'Nhân viên', en: 'Employees' },
  analytics: { vi: 'Phân tích', en: 'Analytics' },
  branding: { vi: 'Thương hiệu', en: 'Branding' },

  // POS & Order Flow
  searchItem: { vi: 'Tìm món ăn / đồ uống...', en: 'Search food / drink...' },
  addToCart: { vi: 'Thêm vào giỏ', en: 'Add to Cart' },
  customize: { vi: 'Tuỳ chỉnh', en: 'Customize' },
  cart: { vi: 'Giỏ hàng', en: 'Cart' },
  subtotal: { vi: 'Tạm tính', en: 'Subtotal' },
  total: { vi: 'Tổng tiền', en: 'Total' },
  checkout: { vi: 'Thanh toán', en: 'Checkout' },
  cash: { vi: 'Tiền mặt', en: 'Cash' },
  bankTransfer: { vi: 'Chuyển khoản VietQR', en: 'VietQR Transfer' },
  options: { vi: 'Tuỳ chọn', en: 'Options' },
  note: { vi: 'Ghi chú', en: 'Note' },
  size: { vi: 'Kích thước', en: 'Size' },
  sugar: { vi: 'Độ ngọt', en: 'Sugar' },
  ice: { vi: 'Lượng đá', en: 'Ice' },
  toppings: { vi: 'Topping đi kèm', en: 'Toppings' },
  quantity: { vi: 'Số lượng', en: 'Quantity' },
  outOfStock: { vi: 'Hết hàng', en: 'Out of Stock' },
  category: { vi: 'Danh mục', en: 'Category' },

  // Order Status
  pending: { vi: 'Chờ xử lý', en: 'Pending' },
  preparing: { vi: 'Đang chế biến', en: 'Preparing' },
  done: { vi: 'Hoàn thành', en: 'Done' },
  delivered: { vi: 'Đã giao', en: 'Delivered' },
  cancelled: { vi: 'Đã hủy', en: 'Cancelled' },
  voidOrder: { vi: 'Hủy', en: 'Void' },

  // Payment
  discount: { vi: 'Giảm giá', en: 'Discount' },
  vat: { vi: 'VAT', en: 'VAT' },
  change: { vi: 'Tiền thừa', en: 'Change' },
  printReceipt: { vi: 'In hóa đơn', en: 'Print Receipt' },
  pay: { vi: 'Thanh toán', en: 'Pay' },

  // Common Actions
  save: { vi: 'Lưu thay đổi', en: 'Save Changes' },
  cancel: { vi: 'Hủy', en: 'Cancel' },
  confirm: { vi: 'Xác nhận', en: 'Confirm' },
  delete: { vi: 'Xóa', en: 'Delete' },
  edit: { vi: 'Chỉnh sửa', en: 'Edit' },
  create: { vi: 'Tạo mới', en: 'Create' },
  search: { vi: 'Tìm kiếm', en: 'Search' },
  filter: { vi: 'Lọc', en: 'Filter' },
  exportData: { vi: 'Xuất', en: 'Export' },
  close: { vi: 'Đóng', en: 'Close' },
  loading: { vi: 'Đang tải...', en: 'Loading...' },
  refresh: { vi: 'Làm mới', en: 'Refresh' },
  language: { vi: 'Ngôn ngữ', en: 'Language' },
  back: { vi: 'Quay lại', en: 'Back' },
  next: { vi: 'Tiếp theo', en: 'Next' },
  finish: { vi: 'Hoàn tất', en: 'Finish' },
  noData: { vi: 'Không có dữ liệu', en: 'No data available' },
  error: { vi: 'Đã xảy ra lỗi', en: 'An error occurred' },
  success: { vi: 'Thành công', en: 'Success' },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (lang: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'vi',
  setLocale: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('vi');

  useEffect(() => {
    const saved = localStorage.getItem('app_locale') as Locale;
    if (saved === 'vi' || saved === 'en') {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (lang: Locale) => {
    setLocaleState(lang);
    localStorage.setItem('app_locale', lang);
  };

  const t = (key: string): string => {
    if (translations[key] && translations[key][locale]) {
      return translations[key][locale];
    }
    return key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
