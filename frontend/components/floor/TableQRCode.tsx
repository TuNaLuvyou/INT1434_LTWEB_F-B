'use client';

import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check, QrCode, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}

interface TableQRCodeProps {
  table: Table;
  tenantId: string;
  branchId: string;
}

export default function TableQRCode({ table, tenantId, branchId }: TableQRCodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Lấy base URL cho app
  const origin = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL;
  const appUrl = origin || 'http://localhost:3000';
  const menuUrl = `${appUrl}/table/${table.id}?tenantId=${tenantId}&branchId=${branchId}`;

  useEffect(() => {
    if (!tenantId) return;
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    fetch(`${API}/api/branding?tenantId=${tenantId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.logoUrl) {
          setLogoUrl(data.data.logoUrl);
        }
      })
      .catch(() => {});
  }, [tenantId]);

  /**
   * Tải xuống QR Code dưới dạng file PNG
   */
  const handleDownloadPNG = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.drawImage(image, 0, 0, 400, 400);
        
        const pngUrl = canvas.toDataURL('image/png');
        
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `QR_Ban_${table.tableNumber}_${table.label.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast.success(`Đã tải xuống file QR Bàn ${table.tableNumber}!`);
      }
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    toast.success('Đã sao chép đường dẫn QR Menu!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-md bg-gradient-to-br from-emerald-950/90 via-zinc-950/95 to-zinc-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(16,185,129,0.18)] backdrop-blur-xl relative overflow-hidden group space-y-6">
      {/* Subtle Emerald Background Glow Effects */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Badge */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <QrCode className="w-3.5 h-3.5" />
          <span>Mã QR Gọi Món Tại Bàn</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
          HD Scan
        </span>
      </div>

      {/* Central White QR Card Container */}
      <div 
        id={`print-qr-${table.id}`} 
        className="flex flex-col items-center bg-white p-6 sm:p-7 rounded-2xl shadow-2xl relative z-10 border border-emerald-100/50 transform group-hover:scale-[1.01] transition-transform duration-300"
      >
        <div className="bg-white p-2 rounded-xl border border-zinc-100 flex items-center justify-center shadow-inner">
          <QRCodeSVG
            id={`qr-${table.id}`}
            ref={svgRef}
            value={menuUrl}
            size={210}
            level="H"
            bgColor="#FFFFFF"
            fgColor="#09090b"
            includeMargin={true}
            imageSettings={
              logoUrl
                ? {
                    src: logoUrl,
                    x: undefined,
                    y: undefined,
                    height: 46,
                    width: 46,
                    excavate: true,
                  }
                : undefined
            }
          />
        </div>

        <div className="mt-4 text-center select-none">
          <h4 className="text-xl font-black text-zinc-950 tracking-tight leading-none">
            BÀN SỐ {table.tableNumber}
          </h4>
          <p className="text-xs text-zinc-500 font-bold mt-1.5 uppercase tracking-widest">
            {table.label}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 w-full relative z-10">
        <button
          type="button"
          onClick={handleDownloadPNG}
          className="flex-1 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-95 cursor-pointer"
        >
          <Download className="h-4 w-4 text-white" />
          <span>Tải QR Code PNG</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="h-11 w-11 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/30 text-zinc-200 hover:text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
          title="Sao chép link QR"
        >
          {copied ? <Check className="h-4.5 w-4.5 text-emerald-400" /> : <Copy className="h-4.5 w-4.5 text-zinc-300" />}
        </button>
      </div>

      {/* URL Link Display Bar */}
      <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3 py-2 flex items-center justify-between relative z-10">
        <p className="text-[10px] text-zinc-400 font-mono break-all select-all truncate pr-2 opacity-80">
          {menuUrl}
        </p>
        <button 
          type="button" 
          onClick={handleCopy}
          className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider shrink-0 cursor-pointer"
        >
          {copied ? 'Đã chép' : 'Chép'}
        </button>
      </div>

    </div>
  );
}
