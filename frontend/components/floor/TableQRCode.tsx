'use client';

import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer } from 'lucide-react';

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}

interface TableQRCodeProps {
  table: Table;
}

export default function TableQRCode({ table }: TableQRCodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Lấy base URL cho app
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const menuUrl = `${appUrl}/table/${table.id}`;

  /**
   * Tải xuống QR Code dưới dạng file PNG
   */
  const handleDownloadPNG = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    // Serialize SVG thành chuỗi XML
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    // Tạo đối tượng Image và Canvas để render PNG
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const context = canvas.getContext('2d');
      if (context) {
        // Đặt nền trắng cho ảnh QR Code
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Vẽ SVG lên Canvas
        context.drawImage(image, 0, 0, 300, 300);
        
        // Convert canvas sang data URL PNG
        const pngUrl = canvas.toDataURL('image/png');
        
        // Tạo link ẩn để trigger download
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `QR_Ban_${table.tableNumber}_${table.label.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  /**
   * Thực hiện in mã QR của bàn hiện tại
   */
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 rounded-3xl bg-zinc-950/60 border border-zinc-800 backdrop-blur-sm relative overflow-hidden group">
      {/* Glow highlight */}
      <div className="absolute -inset-px bg-gradient-to-br from-emerald-500/20 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none" />

      {/* Container in ấn - Đi kèm class CSS đặc tả cho Print */}
      <div id={`print-qr-${table.id}`} className="print-section flex flex-col items-center bg-white p-6 rounded-2xl shadow-sm">
        {/* Style in ấn chỉ áp dụng cho mã QR này khi in */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #print-qr-${table.id}, #print-qr-${table.id} * {
              visibility: visible;
            }
            #print-qr-${table.id} {
              position: absolute;
              left: 50%;
              top: 40%;
              transform: translate(-50%, -50%) scale(1.5);
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              padding: 20px !important;
            }
            .print-no-show {
              display: none !important;
            }
          }
        `}} />

        <div className="bg-white p-2 rounded-xl border border-zinc-100 shadow-sm flex items-center justify-center">
          <QRCodeSVG
            id={`qr-${table.id}`}
            ref={svgRef}
            value={menuUrl}
            size={200}
            level="M"
            bgColor="#FFFFFF"
            fgColor="#000000"
            includeMargin={true}
          />
        </div>

        <div className="mt-4 text-center">
          <h4 className="text-lg font-extrabold text-zinc-950 tracking-tight leading-none">BÀN SỐ {table.tableNumber}</h4>
          <p className="text-xs text-zinc-500 font-medium mt-1 uppercase tracking-wider">{table.label}</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 w-full print-no-show relative z-10">
        <button
          onClick={handleDownloadPNG}
          className="flex-1 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 hover:text-white flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <Download className="h-4 w-4" />
          Tải QR (PNG)
        </button>

        <button
          onClick={handlePrint}
          className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md shadow-emerald-950/20 cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          In mã QR
        </button>
      </div>

      <p className="text-[10px] text-zinc-500 text-center select-all select-none print-no-show font-mono break-all opacity-60">
        {menuUrl}
      </p>
    </div>
  );
}
