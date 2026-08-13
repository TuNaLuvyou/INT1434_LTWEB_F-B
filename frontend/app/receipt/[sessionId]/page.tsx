"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ReceiptPrintTemplate, ReceiptItem } from "@/components/print/ReceiptPrintTemplate";
import { Loader2, Printer, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ReceiptPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: `
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
    `,
  });

  useEffect(() => {
    if (!sessionId) return;
    const fetchSessionReceipt = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/sessions/${sessionId}/receipt`);
        const result = await res.json();

        if (res.ok && result.success) {
          const data = result.data;
          const allItems: ReceiptItem[] = [];

          if (data.items) {
            data.items.forEach((item: any) => {
              if (item.status !== "VOID") {
                allItems.push({
                  id: item.id,
                  name: item.menuItem?.name || item.name || "Món ăn",
                  qty: item.qty || item.quantity || 1,
                  unitPrice: Number(item.unitPrice || item.menuItem?.price || 0),
                  selectedOptions: item.selectedOptions || [],
                  note: item.note,
                });
              }
            });
          }

          const subtotal = allItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

          setReceiptData({
            tableLabel: data.tableLabel || data.tableNumber || "Bàn",
            sessionId,
            createdAt: new Date(data.openedAt).toLocaleString("vi-VN"),
            items: allItems,
            subtotal,
            finalTotal: data.total || subtotal,
            paymentMethod: data.paymentMethod || "Đã thanh toán",
          });
        } else {
          setError(result.message || "Không thể tải thông tin hoá đơn.");
        }
      } catch (err: any) {
        console.error("Lỗi tải hoá đơn:", err);
        setError("Lỗi khi kết nối với máy chủ.");
      } finally {
        setLoading(false);
      }
    };

    fetchSessionReceipt();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin mb-3" />
        <p className="text-xs text-gray-500 font-medium">Đang tải hoá đơn...</p>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full space-y-4">
          <p className="text-sm font-semibold text-rose-500">{error || "Không tìm thấy thông tin hoá đơn."}</p>
          <button
            onClick={() => window.history.back()}
            className="w-full py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 flex flex-col items-center justify-center">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background-color: #f3f4f6 !important; }
      `}} />
      {/* Header Bar */}
      <div className="w-full max-w-md bg-white rounded-2xl p-4 shadow-sm border border-gray-200/80 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
          <CheckCircle2 size={18} />
          <span>Biên lai điện tử (E-Receipt)</span>
        </div>
        <button
          onClick={() => handlePrint()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <Printer size={14} />
          <span>Tải PDF / In</span>
        </button>
      </div>

      {/* Printable Receipt Paper */}
      <div className="bg-white shadow-xl rounded-2xl p-2 border border-gray-200 max-w-md w-full overflow-hidden">
        <ReceiptPrintTemplate ref={printRef} {...receiptData} />
      </div>

      <p className="text-[11px] text-gray-400 mt-4 text-center">
        Quý khách có thể bấm nút &quot;Tải PDF / In&quot; trên để lưu hoặc in hoá đơn về máy.
      </p>
    </div>
  );
}
