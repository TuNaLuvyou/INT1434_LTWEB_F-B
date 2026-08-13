import React, { forwardRef } from 'react';

interface KitchenTicketItem {
  id?: string;
  name: string;
  qty: number;
  selectedOptions?: string[];
  note?: string;
}

export interface KitchenTicketPrintProps {
  tableLabel?: string | number;
  ticketId?: string;
  createdAt?: string;
  items: KitchenTicketItem[];
  staffName?: string;
}

export const KitchenTicketTemplate = forwardRef<HTMLDivElement, KitchenTicketPrintProps>((props, ref) => {
  const {
    tableLabel = "Mang về",
    ticketId,
    createdAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    items = [],
    staffName,
  } = props;

  return (
    <div
      ref={ref}
      className="kitchen-ticket-root p-2 bg-white text-black font-sans text-xs w-[80mm] max-w-full mx-auto"
      style={{ fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
    >
      <style>{`
        @page {
          size: 80mm 120mm;
          margin: 0;
        }
        @media print {
          html, body {
            width: 80mm !important;
            height: 120mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .kitchen-ticket-root {
            width: 80mm !important;
            max-width: 80mm !important;
            padding: 8px !important;
            margin: 0 auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="text-center border-b-2 border-black pb-2 mb-3">
        <h2 className="text-lg font-black uppercase tracking-wider">PHIẾU CHẾ BIẾN</h2>
        <div className="mt-1 bg-black text-white py-1.5 rounded text-base font-extrabold uppercase">
          BÀN: {tableLabel}
        </div>
      </div>

      {/* Meta Info */}
      <div className="text-[11px] border-b border-black pb-2 mb-2 space-y-0.5">
        {ticketId && (
          <div className="flex justify-between">
            <span>Mã lượt:</span>
            <span className="font-bold">#{ticketId.slice(-6).toUpperCase()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Thời gian báo bếp:</span>
          <span className="font-semibold">{createdAt}</span>
        </div>
        {staffName && (
          <div className="flex justify-between">
            <span>Thu ngân / Nhân viên:</span>
            <span>{staffName}</span>
          </div>
        )}
      </div>

      {/* Items List (Big & Clear for Chefs) */}
      <div className="mb-4 divide-y divide-black">
        {items.map((item, idx) => (
          <div key={idx} className="py-2.5 flex items-start gap-2">
            <span className="text-base font-black border-2 border-black px-2 py-0.5 rounded min-w-[28px] text-center bg-gray-100">
              {item.qty}
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold leading-tight">{item.name}</div>
              {item.selectedOptions && item.selectedOptions.length > 0 && (
                <div className="text-[11px] font-semibold text-gray-800 mt-1 pl-1">
                  + {item.selectedOptions.join(', ')}
                </div>
              )}
              {item.note && (
                <div className="text-xs text-black mt-1 space-y-0.5 pl-1 font-medium">
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
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center border-t-2 border-black pt-2">
        <p className="text-[10px] font-bold text-gray-700">--- VUI LÒNG CHẾ BIẾN THEO THỨ TỰ ---</p>
      </div>
    </div>
  );
});

KitchenTicketTemplate.displayName = 'KitchenTicketTemplate';
