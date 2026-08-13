import React, { forwardRef } from 'react';

export interface ReceiptItem {
  id?: string;
  name: string;
  qty: number;
  unitPrice: number;
  selectedOptions?: string[];
  note?: string;
}

export interface ReceiptPrintProps {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  branchName?: string;
  tableLabel?: string | number;
  orderId?: string;
  sessionId?: string;
  createdAt?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  vatAmount?: number;
  finalTotal: number;
  paymentMethod?: string;
  customerName?: string;
  earnedPoints?: number;
}

export const ReceiptPrintTemplate = forwardRef<HTMLDivElement, ReceiptPrintProps>((props, ref) => {
  const {
    storeName = "HIAI-MENUGO RESTAURANT",
    storeAddress = "Hệ thống quản lý nhà hàng thông minh",
    storePhone,
    branchName,
    tableLabel = "Mang về",
    orderId,
    sessionId,
    createdAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    items = [],
    subtotal = 0,
    discount = 0,
    vatAmount = 0,
    finalTotal = 0,
    paymentMethod = "Tiền mặt",
    customerName,
    earnedPoints = 0,
  } = props;

  const formattedTableLabel = React.useMemo(() => {
    if (!tableLabel) return "Mang về";
    const str = String(tableLabel).trim();
    if (str.startsWith("Bàn") || str === "Mang về") return str;
    return `Bàn ${str}`;
  }, [tableLabel]);

  return (
    <div
      ref={ref}
      className="receipt-print-root p-6 bg-white text-black font-mono text-sm w-full max-w-full mx-auto"
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
    >
      <style>{`
        @page {
          size: auto;
          margin: 0mm;
        }
        @media print {
          html, body {
            width: 100% !important;
            min-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .receipt-print-root {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            padding: 12mm 15mm !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-black pb-4 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wider">{storeName}</h2>
        {branchName && <p className="text-sm font-semibold mt-1">{branchName}</p>}
        {storeAddress && <p className="text-xs sm:text-sm text-gray-700 mt-1">{storeAddress}</p>}
        {storePhone && <p className="text-xs sm:text-sm text-gray-700">Hotline: {storePhone}</p>}
        <h3 className="text-base sm:text-lg font-bold mt-3 uppercase border-t border-b-2 border-black py-1.5">
          HOÁ ĐƠN THANH TOÁN
        </h3>
      </div>

      {/* Meta Info */}
      <div className="text-sm sm:text-base border-b border-dashed border-black pb-3 mb-3 space-y-1.5">
        <div className="flex justify-between">
          <span className="font-bold">Bàn / Khu vực:</span>
          <span className="font-bold text-base">{formattedTableLabel}</span>
        </div>
        {orderId ? (
          <div className="flex justify-between">
            <span className="font-bold">Mã đơn:</span>
            <span className="font-bold">{orderId}</span>
          </div>
        ) : sessionId ? (
          <div className="flex justify-between">
            <span>Mã phiên:</span>
            <span>#{sessionId.slice(-6).toUpperCase()}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span>Thời gian:</span>
          <span>{createdAt}</span>
        </div>
        {customerName && (
          <div className="flex justify-between">
            <span>Khách hàng:</span>
            <span className="font-semibold">{customerName}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full text-left text-sm sm:text-base mb-4">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2 font-bold">Tên món</th>
            <th className="py-2 text-center w-16 font-bold">SL</th>
            <th className="py-2 text-right w-28 font-bold">Đ.Giá</th>
            <th className="py-2 text-right w-28 font-bold">T.Tiền</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item, idx) => {
            const lineTotal = item.qty * item.unitPrice;
            return (
              <tr key={idx} className="align-top">
                <td className="py-2 pr-2">
                  <div className="font-semibold">{item.name}</div>
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <div className="text-xs text-gray-600 pl-1">
                      + {item.selectedOptions.join(', ')}
                    </div>
                  )}
                  {item.note && (
                    <div className="text-xs text-black mt-0.5 space-y-0.5 pl-1">
                      {String(item.note)
                        .replace(/📝?\s*Ghi chú:\s*/gi, '')
                        .split(/•|;|\||\n/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((line, nIdx) => (
                          <div key={nIdx} className="leading-tight">
                            - {line}
                          </div>
                        ))}
                    </div>
                  )}
                </td>
                <td className="py-2 text-center font-bold">{item.qty}</td>
                <td className="py-2 text-right">{item.unitPrice.toLocaleString('vi-VN')}</td>
                <td className="py-2 text-right font-semibold">{lineTotal.toLocaleString('vi-VN')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t-2 border-dashed border-black pt-3 text-sm sm:text-base space-y-2">
        <div className="flex justify-between">
          <span>Tạm tính:</span>
          <span>{subtotal.toLocaleString('vi-VN')} đ</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-rose-600 font-medium">
            <span>Giảm giá / Voucher:</span>
            <span>-{discount.toLocaleString('vi-VN')} đ</span>
          </div>
        )}
        {vatAmount > 0 && (
          <div className="flex justify-between">
            <span>Thuế VAT:</span>
            <span>+{vatAmount.toLocaleString('vi-VN')} đ</span>
          </div>
        )}
        <div className="flex justify-between text-lg sm:text-xl font-bold border-t-2 border-b-2 border-black py-2.5 mt-2">
          <span>TỔNG CỘNG:</span>
          <span>{finalTotal.toLocaleString('vi-VN')} đ</span>
        </div>
        <div className="flex justify-between pt-1">
          <span>Hình thức T.Toán:</span>
          <span className="font-semibold">{paymentMethod}</span>
        </div>
        {earnedPoints > 0 && (
          <div className="flex justify-between text-sm">
            <span>Điểm tích luỹ đợt này:</span>
            <span className="font-semibold">+{earnedPoints} điểm</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-6 border-t border-dashed border-black pt-4">
        <p className="font-bold text-sm sm:text-base">CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</p>
        <p className="text-xs text-gray-500 mt-1">Powered by HiAI-MenuGo System</p>
      </div>
    </div>
  );
});

ReceiptPrintTemplate.displayName = 'ReceiptPrintTemplate';
