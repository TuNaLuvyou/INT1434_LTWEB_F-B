'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { 
  Check, 
  ImageOff, 
  Loader2, 
  Palette, 
  Upload, 
  UtensilsCrossed, 
  ImageIcon, 
  Sparkles, 
  Trash2,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessTokenFromCookie } from '@/lib/auth/client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface BrandingData {
  displayName?: string | null;
  foodType?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  backgroundUrl?: string | null;
}

// Curated F&B Color Presets
const COLOR_PRESETS = [
  { name: 'Royal Violet', primary: '#7c3aed', secondary: '#4f46e5', desc: 'Hiện đại, Sang trọng' },
  { name: 'Sunset Orange', primary: '#ea580c', secondary: '#f59e0b', desc: 'Lẩu & BBQ, Thức ăn nhanh' },
  { name: 'Emerald Tea', primary: '#059669', secondary: '#10b981', desc: 'Trà sữa, Matcha, Healthy' },
  { name: 'Rose Boba', primary: '#db2777', secondary: '#f43f5e', desc: 'Cà phê, Bánh ngọt, Trà hoa' },
  { name: 'Midnight Gold', primary: '#d97706', secondary: '#b45309', desc: 'Fine Dining, Steakhouse' },
  { name: 'Crimson Steak', primary: '#dc2626', secondary: '#991b1b', desc: 'Nhà hàng, Quán Nhậu' },
];

function ColorPickerField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="space-y-2 relative" ref={ref}>
      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">{label}</label>
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-950 border border-zinc-800 hover:border-violet-500/40 rounded-2xl cursor-pointer transition-all duration-200 group"
      >
        <span className="h-6 w-6 rounded-xl border border-white/20 shrink-0 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: value }} />
        <span className="font-mono text-sm text-zinc-100 font-bold tracking-wider">{value.toUpperCase()}</span>
        <Palette className="h-4 w-4 text-zinc-500 group-hover:text-violet-400 ml-auto transition-colors" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 p-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-3xl shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150">
          <HexColorPicker color={value} onChange={onChange} />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400">HEX:</span>
            <input 
              value={value} 
              onChange={(e) => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) && onChange(e.target.value)} 
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-zinc-100 focus:outline-none focus:border-violet-500" 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrandingTab() {
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [foodType, setFoodType] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [secondaryColor, setSecondaryColor] = useState('#7c3aed');
  const [colorMode, setColorMode] = useState<'SINGLE' | 'GRADIENT'>('SINGLE');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/branding`, { headers: { Authorization: `Bearer ${getAccessTokenFromCookie()}` } })
      .then((res) => res.json())
      .then((result) => {
        if (!result.success || !result.data) return;
        const data: BrandingData = result.data;
        setBranding(data);
        setDisplayName(data.displayName || '');
        setFoodType(data.foodType || '');
        const p = data.primaryColor || '#7c3aed';
        const s = data.secondaryColor || p;
        setPrimaryColor(p);
        setSecondaryColor(s);
        setColorMode(p === s ? 'SINGLE' : 'GRADIENT');
        setLogoUrl(data.logoUrl || null);
        setBannerUrl(data.bannerUrl || null);
        setBackgroundUrl(data.backgroundUrl || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return void toast.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
    if (file.size > 5 * 1024 * 1024) return void toast.error('Logo không được lớn hơn 5MB.');
    setUploadingLogo(true);
    const toastId = toast.loading('Đang tải lên và tách nền logo...');
    try {
      const body = new FormData();
      body.append('logo', file);
      const response = await fetch(`${API}/api/branding/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessTokenFromCookie()}` },
        body,
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setLogoUrl(result.data.logoUrl);
      setBranding(result.data.branding);
      toast.success('Đã tải logo và tự động tách nền.', { id: toastId });
    } catch (error: any) {
      toast.error(error.message || 'Tải logo thất bại.', { id: toastId });
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadAsset = async (file: File, field: 'banner' | 'background') => {
    const setUploading = field === 'banner' ? setUploadingBanner : setUploadingBg;
    const setUrl = field === 'banner' ? setBannerUrl : setBackgroundUrl;
    
    setUploading(true);
    const toastId = toast.loading(`Đang tải ${field === 'banner' ? 'banner' : 'hình nền'}...`);
    try {
      const body = new FormData();
      body.append(field, file);
      const response = await fetch(`${API}/api/branding/${field}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessTokenFromCookie()}` },
        body,
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setUrl(result.data.url);
      toast.success(`Đã tải ${field === 'banner' ? 'banner' : 'hình nền'} thành công.`, { id: toastId });
    } catch (error: any) {
      toast.error(error.message || `Tải ${field === 'banner' ? 'banner' : 'hình nền'} thất bại.`, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const saveBranding = async () => {
    setSaving(true);
    const finalSecondary = colorMode === 'SINGLE' ? primaryColor : secondaryColor;
    try {
      const response = await fetch(`${API}/api/branding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessTokenFromCookie()}`,
        },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          foodType: foodType.trim() || null,
          primaryColor,
          secondaryColor: finalSecondary,
          logoUrl,
          bannerUrl,
          backgroundUrl,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setBranding(result.data);
      toast.success('Đã lưu và áp dụng cấu hình thương hiệu!');
    } catch (error: any) {
      toast.error(error.message || 'Lưu thương hiệu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        <Loader2 className="animate-spin h-8 w-8 text-violet-500 mr-3" />
        Đang tải cấu hình thương hiệu...
      </div>
    );
  }

  const activeSecondary = colorMode === 'SINGLE' ? primaryColor : secondaryColor;
  const gradientStyle = colorMode === 'SINGLE' ? primaryColor : `linear-gradient(135deg, ${primaryColor}, ${activeSecondary})`;

  return (
    <div className="space-y-6 w-full pb-16">
      
      {/* Top Branding Settings Card with Save Button */}
      <div>
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Giao Diện & Thương Hiệu QR Menu</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tuỳ chỉnh màu sắc, Logo và hình ảnh. Thay đổi sẽ đồng bộ realtime trên màn hình gọi món tại bàn.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={saveBranding}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 cursor-pointer shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 shrink-0 self-start sm:self-auto"
            style={{ background: gradientStyle }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: Thông tin thương hiệu */}
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-xl backdrop-blur-sm">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-violet-400" />
                Thông Tin Thương Hiệu
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Tên nhà hàng và loại hình ẩm thực hiển thị ở đầu trang Menu.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Tên nhà hàng / Thương hiệu</label>
                <input 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  placeholder="Ví dụ: Lẩu & BBQ Hàn Quốc" 
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-violet-500/50 rounded-2xl text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Loại hình phục vụ</label>
                <input 
                  value={foodType} 
                  onChange={(e) => setFoodType(e.target.value)} 
                  placeholder="Ví dụ: Ẩm thực Hàn Quốc, Cà phê & Bánh mì" 
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-violet-500/50 rounded-2xl text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all" 
                />
              </div>
            </div>
          </section>

          {/* Section 2: Gợi ý Bộ Màu Chuẩn F&B (Color Presets) */}
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Bộ Màu Gợi Ý Chuẩn F&B
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Chọn nhanh bộ phối màu chuyên nghiệp hợp phong cách quán</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = primaryColor === preset.primary && secondaryColor === preset.secondary;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary);
                      setSecondaryColor(preset.secondary);
                      setColorMode(preset.primary === preset.secondary ? 'SINGLE' : 'GRADIENT');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative group overflow-hidden ${
                      isSelected
                        ? 'bg-zinc-900 border-violet-500 ring-2 ring-violet-500/30 shadow-lg'
                        : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-white truncate">{preset.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-violet-400 shrink-0" />}
                    </div>
                    <div 
                      className="h-3 rounded-full transition-all"
                      style={{ background: `linear-gradient(90deg, ${preset.primary}, ${preset.secondary})` }}
                    />
                    <span className="text-[9px] text-zinc-500 font-medium block mt-1.5 truncate">{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 3: Tùy Chỉnh Màu Sắc */}
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-violet-400" />
                  Màu Sắc Chủ Đạo
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Tuỳ chỉnh màu cho nút bấm, header và các danh mục món.</p>
              </div>

              {/* Mode Switcher */}
              <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setColorMode('SINGLE');
                    setSecondaryColor(primaryColor);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    colorMode === 'SINGLE'
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Đơn màu
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode('GRADIENT')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    colorMode === 'GRADIENT'
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Gradient (2 màu)
                </button>
              </div>
            </div>

            {/* Pickers Grid */}
            <div className={`grid gap-4 ${colorMode === 'GRADIENT' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              <ColorPickerField
                label={colorMode === 'SINGLE' ? 'Màu chủ đạo' : 'Màu bắt đầu (Primary)'}
                value={primaryColor}
                onChange={(val) => {
                  setPrimaryColor(val);
                  if (colorMode === 'SINGLE') {
                    setSecondaryColor(val);
                  }
                }}
              />
              {colorMode === 'GRADIENT' && (
                <ColorPickerField
                  label="Màu kết thúc (Secondary)"
                  value={secondaryColor}
                  onChange={setSecondaryColor}
                />
              )}
            </div>

            {/* Live Gradient Preview Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] font-semibold text-zinc-500">
                <span>Xem trước dải màu:</span>
                <span className="font-mono text-zinc-400">{colorMode === 'SINGLE' ? primaryColor : `${primaryColor} → ${activeSecondary}`}</span>
              </div>
              <div
                className="h-4 rounded-2xl transition-all duration-300 shadow-inner"
                style={{ background: gradientStyle }}
              />
            </div>
          </section>

          {/* Section 4: Quản lý Hình Ảnh Thương Hiệu (Grid 3 Thẻ) */}
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-xl backdrop-blur-sm">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-violet-400" />
                Bộ Hình Ảnh Thương Hiệu
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Tải Logo (tự động tách nền AI), Banner và Hình nền cho trang Menu.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Logo */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3.5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-bold text-zinc-300 uppercase">Logo (AI Tách Nền)</span>
                    {logoUrl && (
                      <button onClick={() => setLogoUrl(null)} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer" title="Xoá logo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="h-28 rounded-xl bg-zinc-900/80 border border-zinc-800 overflow-hidden flex items-center justify-center p-2 relative">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-contain drop-shadow-md" />
                    ) : (
                      <div className="text-center text-zinc-600">
                        <ImageOff className="h-6 w-6 mx-auto mb-1 opacity-40" />
                        <span className="text-[10px]">Chưa có logo</span>
                      </div>
                    )}
                  </div>
                </div>

                <label className="w-full py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ background: gradientStyle }}>
                  {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  <span>{logoUrl ? 'Đổi Logo' : 'Tải Logo'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingLogo} onChange={uploadLogo} className="sr-only" />
                </label>
              </div>

              {/* Card 2: Banner */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3.5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-bold text-zinc-300 uppercase">Banner Header</span>
                    {bannerUrl && (
                      <button onClick={() => setBannerUrl(null)} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer" title="Xoá banner">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="h-28 rounded-xl bg-zinc-900/80 border border-zinc-800 overflow-hidden flex items-center justify-center p-1 relative">
                    {bannerUrl ? (
                      <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className="text-center text-zinc-600">
                        <ImageOff className="h-6 w-6 mx-auto mb-1 opacity-40" />
                        <span className="text-[10px]">Chưa có banner</span>
                      </div>
                    )}
                  </div>
                </div>

                <label className="w-full py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ background: gradientStyle }}>
                  {uploadingBanner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  <span>{bannerUrl ? 'Đổi Banner' : 'Tải Banner'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingBanner} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, 'banner'); e.target.value = ''; }} className="sr-only" />
                </label>
              </div>

              {/* Card 3: Background */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3.5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-bold text-zinc-300 uppercase">Hình Nền Menu</span>
                    {backgroundUrl && (
                      <button onClick={() => setBackgroundUrl(null)} className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer" title="Xoá hình nền">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="h-28 rounded-xl bg-zinc-900/80 border border-zinc-800 overflow-hidden flex items-center justify-center p-1 relative">
                    {backgroundUrl ? (
                      <img src={backgroundUrl} alt="Background" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className="text-center text-zinc-600">
                        <ImageOff className="h-6 w-6 mx-auto mb-1 opacity-40" />
                        <span className="text-[10px]">Chưa có hình nền</span>
                      </div>
                    )}
                  </div>
                </div>

                <label className="w-full py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ background: gradientStyle }}>
                  {uploadingBg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  <span>{backgroundUrl ? 'Đổi Nền' : 'Tải Hình Nền'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingBg} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, 'background'); e.target.value = ''; }} className="sr-only" />
                </label>
              </div>
            </div>
          </section>
      </div>
    </div>
  );
}
