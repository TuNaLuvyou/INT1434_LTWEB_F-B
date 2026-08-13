"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Upload, X, Loader2, Sparkles, CupSoda, Utensils, Candy, Flame, Plus, Check } from "lucide-react";
import Image from "next/image";
import { getAccessTokenFromCookie } from "@/lib/auth/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const menuItemSchema = z.object({
  name: z.string().min(2, "Tên món ăn phải có ít nhất 2 ký tự"),
  description: z.string().optional(),
  price: z.number({ message: "Giá tiền phải là một số" }).positive("Giá tiền phải lớn hơn 0"),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục món ăn"),
  isDrink: z.boolean(),
});

type MenuItemFormValues = z.infer<typeof menuItemSchema>;

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  englishName?: string | null;
  description: string | null;
  price: string | number;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
  isSoldOut: boolean;
  hasSizes?: boolean;
}

interface MenuItemFormProps {
  categories: Category[];
  initialData?: MenuItem | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
}

const DEFAULT_SUGAR_TAGS = ["100% đường", "70% đường", "50% đường", "30% đường", "Không đường"];
const DEFAULT_ICE_TAGS = ["100% đá", "70% đá", "50% đá", "Ít đá", "Không đá", "Đá riêng"];

const SUGAR_PRESETS = ["100% đường", "70% đường", "50% đường", "30% đường", "Không đường", "Đường ăn kiêng", "Ít ngọt"];
const ICE_PRESETS = ["100% đá", "70% đá", "50% đá", "Ít đá", "Không đá", "Đá riêng", "Uống nóng", "Ấm"];

export default function MenuItemForm({
  categories,
  initialData,
  onSubmitSuccess,
  onCancel,
}: MenuItemFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.imageUrl || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price ? Number(initialData.price) : (undefined as any),
      categoryId: initialData?.categoryId || "",
      isDrink: initialData?.hasSizes ?? true,
    },
  });

  // Parse Sugar & Ice tags for this specific drink item
  const parseOptionsFromItem = () => {
    try {
      if ((initialData as any)?.englishName) {
        const parsed = JSON.parse((initialData as any).englishName);
        const sTags = parsed.sugar ? parsed.sugar.split(",").map((s: string) => s.trim()).filter(Boolean) : DEFAULT_SUGAR_TAGS;
        const iTags = parsed.ice ? parsed.ice.split(",").map((i: string) => i.trim()).filter(Boolean) : DEFAULT_ICE_TAGS;
        return { sTags, iTags };
      }
    } catch (e) {}
    return { sTags: DEFAULT_SUGAR_TAGS, iTags: DEFAULT_ICE_TAGS };
  };

  const parsedInitial = parseOptionsFromItem();
  const [sugarList, setSugarList] = useState<string[]>(parsedInitial.sTags);
  const [iceList, setIceList] = useState<string[]>(parsedInitial.iTags);

  const [newSugarInput, setNewSugarInput] = useState("");
  const [newIceInput, setNewIceInput] = useState("");

  const watchName = watch("name");
  const watchPrice = watch("price");
  const watchIsDrink = watch("isDrink");

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Kích thước file ảnh vượt quá giới hạn 5MB");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setSubmitError("Định dạng ảnh không hợp lệ (Chỉ nhận JPG, PNG, WEBP)");
      return;
    }

    setSubmitError(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // Sugar tag handlers
  const handleAddSugar = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !sugarList.includes(trimmed)) {
      setSugarList([...sugarList, trimmed]);
      setNewSugarInput("");
    }
  };

  const handleRemoveSugar = (tagToRemove: string) => {
    setSugarList(sugarList.filter(s => s !== tagToRemove));
  };

  // Ice tag handlers
  const handleAddIce = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !iceList.includes(trimmed)) {
      setIceList([...iceList, trimmed]);
      setNewIceInput("");
    }
  };

  const handleRemoveIce = (tagToRemove: string) => {
    setIceList(iceList.filter(i => i !== tagToRemove));
  };

  const [isAvailableOnPos, setIsAvailableOnPos] = useState<boolean>((initialData as any)?.isAvailableOnPos ?? true);
  const [isAvailableOnQr, setIsAvailableOnQr] = useState<boolean>((initialData as any)?.isAvailableOnQr ?? true);

  const onSubmit = async (values: MenuItemFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("description", values.description || "");
      formData.append("price", String(values.price));
      formData.append("categoryId", values.categoryId);
      formData.append("hasSizes", String(values.isDrink));
      formData.append("isAvailableOnPos", String(isAvailableOnPos));
      formData.append("isAvailableOnQr", String(isAvailableOnQr));
      
      const customOptionsJson = JSON.stringify({
        sugar: sugarList.join(", "),
        ice: iceList.join(", ")
      });
      formData.append("englishName", customOptionsJson);

      formData.append("isActive", String(initialData?.isActive ?? true));
      formData.append("isSoldOut", String(initialData?.isSoldOut ?? false));

      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      const url = initialData
        ? `${API_URL}/api/admin/menu-items/${initialData.id}`
        : `${API_URL}/api/admin/menu-items`;

      const method = initialData ? "PUT" : "POST";

      const accessToken = getAccessTokenFromCookie();
      const response = await fetch(url, {
        method,
        body: formData,
        headers: {
          "Authorization": `Bearer ${accessToken || ""}`
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Đã xảy ra lỗi trong quá trình xử lý");
      }

      onSubmitSuccess();
    } catch (err: any) {
      console.error("[Submit Form Món ăn] Lỗi:", err);
      setSubmitError(err.message || "Không thể kết nối đến máy chủ API");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {submitError && (
          <div className="p-3.5 bg-red-950/30 text-red-400 rounded-2xl text-xs font-bold border border-red-900/40">
            ⚠️ {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: Core Item Details */}
          <div className="space-y-5 bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-3xl">
            <h4 className="font-extrabold text-zinc-100 text-sm border-b border-zinc-800 pb-2 flex items-center gap-2">
              <Utensils size={16} className="text-violet-400" />
              <span>Thông tin món ăn</span>
            </h4>

            {/* Tên món ăn */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                Tên món ăn <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register("name")}
                placeholder="Ví dụ: Trà sữa nướng, Cà phê sữa đá, Cơm tấm..."
                className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-zinc-100 bg-zinc-950 shadow-inner ${
                  errors.name ? "border-red-500/50 bg-red-950/20 text-red-200" : "border-zinc-800 focus:border-violet-500/50"
                }`}
              />
              {errors.name && (
                <p className="text-[11px] text-red-400 font-bold mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Danh mục và Giá */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Danh mục <span className="text-red-500">*</span>
                </label>
                <select
                  {...register("categoryId")}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-zinc-100 bg-zinc-950 shadow-inner ${
                    errors.categoryId ? "border-red-500/50 bg-red-950/20 text-red-200" : "border-zinc-800 focus:border-violet-500/50"
                  }`}
                >
                  <option value="" className="bg-zinc-950 text-zinc-400">-- Chọn danh mục --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-zinc-950 text-zinc-100">
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="text-[11px] text-red-400 font-bold mt-1">{errors.categoryId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                  Giá bán (VND) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  {...register("price", { valueAsNumber: true })}
                  placeholder="35000"
                  className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-zinc-100 bg-zinc-950 shadow-inner ${
                    errors.price ? "border-red-500/50 bg-red-950/20 text-red-200" : "border-zinc-800 focus:border-violet-500/50"
                  }`}
                />
                {errors.price && (
                  <p className="text-[11px] text-red-400 font-bold mt-1">{errors.price.message}</p>
                )}
              </div>
            </div>

            {/* Mô tả */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                Mô tả món ăn
              </label>
              <textarea
                {...register("description")}
                rows={3}
                placeholder="Mô tả hương vị, thành phần..."
                className="w-full px-4 py-3 rounded-2xl border border-zinc-800 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 bg-zinc-950 text-zinc-100 placeholder-zinc-500 shadow-inner resize-none"
              />
            </div>

            {/* Upload Hình ảnh */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                Hình ảnh món ăn
              </label>

              {previewUrl ? (
                <div className="relative w-full h-40 rounded-2xl overflow-hidden group border border-zinc-800 bg-zinc-950 shadow-inner">
                  <Image
                    src={previewUrl}
                    alt="Món ăn preview"
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <label className="p-2.5 bg-zinc-900 text-zinc-200 rounded-full hover:bg-violet-600 hover:text-white transition-colors cursor-pointer shadow-md border border-zinc-800">
                      <Upload size={16} />
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-2.5 bg-zinc-900 text-red-400 rounded-full hover:bg-red-600 hover:text-white transition-colors shadow-md border border-zinc-800"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {selectedFile && (
                    <span className="absolute bottom-2.5 left-2.5 bg-violet-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
                      <Sparkles size={10} /> Sẵn sàng upload
                    </span>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-800 rounded-2xl cursor-pointer bg-zinc-950 hover:bg-violet-500/5 hover:border-violet-500/40 transition-all group">
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-400 group-hover:scale-110 transition-transform mb-2 border border-violet-500/20">
                      <Upload size={20} className="stroke-[2.5]" />
                    </div>
                    <p className="text-xs font-extrabold text-zinc-300">Tải ảnh lên Cloudinary</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 font-semibold">JPG, PNG, WEBP (Max 5MB)</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>

            {/* Kênh hiển thị (POS vs QR Menu) */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                Kênh hiển thị thực đơn
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsAvailableOnPos(!isAvailableOnPos)}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                    isAvailableOnPos
                      ? "bg-violet-500/10 border-violet-500/40 text-violet-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="flex items-center gap-1.5">🖥️ Máy POS</span>
                  <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${isAvailableOnPos ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-600"}`}>
                    {isAvailableOnPos ? "✓" : ""}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAvailableOnQr(!isAvailableOnQr)}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                    isAvailableOnQr
                      ? "bg-violet-500/10 border-violet-500/40 text-violet-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500"
                  }`}
                >
                  <span className="flex items-center gap-1.5">📱 Menu Quét QR</span>
                  <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${isAvailableOnQr ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-600"}`}>
                    {isAvailableOnQr ? "✓" : ""}
                  </span>
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Drink Type Selector & Interactive Sugar/Ice/Topping Tag Manager */}
          <div className="space-y-5 flex flex-col justify-between">
            
            <div className="space-y-4 bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-3xl">
              
              {/* Custom Styled Toggle Switch: Đây là đồ uống */}
              <div 
                onClick={() => setValue("isDrink", !watchIsDrink)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                  watchIsDrink
                    ? "bg-gradient-to-r from-violet-950/40 via-zinc-900 to-indigo-950/40 border-violet-500/50 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/30"
                    : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-zinc-100">Đây là Đồ Uống</p>
                  {watchIsDrink && (
                    <span className="text-[10px] font-black bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Kèm Đường, Đá & Topping
                    </span>
                  )}
                </div>

                {/* Custom Animated Toggle Switch Knob */}
                <div className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out relative flex items-center shrink-0 ${
                  watchIsDrink ? "bg-gradient-to-r from-violet-600 to-indigo-500 shadow-inner" : "bg-zinc-800"
                }`}>
                  <div className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                    watchIsDrink ? "translate-x-5.5 text-violet-600" : "translate-x-0 text-zinc-500"
                  }`}>
                    {watchIsDrink && <Check size={13} className="stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* Nếu là Đồ Uống: Cấu hình Mức Đường & Mức Đá trực quan */}
              {watchIsDrink && (
                <div className="space-y-5 pt-2 animate-in fade-in duration-200">
                  
                  {/* 1. Mức Đường */}
                  <div className="space-y-2.5 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Candy size={14} /> Mức Đường cho món này ({sugarList.length})
                      </label>
                    </div>

                    {/* Active Sugar Badges */}
                    <div className="flex flex-wrap gap-1.5 min-h-9 p-2 rounded-xl bg-zinc-900 border border-zinc-800/80 items-center">
                      {sugarList.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-bold shadow-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveSugar(tag)}
                            className="text-amber-400/60 hover:text-red-400 transition-colors"
                            title="Xóa mức đường này"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                      {sugarList.length === 0 && (
                        <span className="text-xs text-zinc-500 italic">Chưa chọn mức đường nào...</span>
                      )}
                    </div>

                    {/* Add Sugar Input & Presets */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newSugarInput}
                        onChange={(e) => setNewSugarInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSugar(newSugarInput);
                          }
                        }}
                        placeholder="Thêm mức đường tùy chỉnh..."
                        className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-100 focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSugar(newSugarInput)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} /> Thêm
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="text-[10px] text-zinc-500 font-bold self-center mr-1">Gợi ý nhanh:</span>
                      {SUGAR_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleAddSugar(preset)}
                          disabled={sugarList.includes(preset)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            sugarList.includes(preset)
                              ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                              : 'bg-amber-400/10 border border-amber-400/20 text-amber-300 hover:bg-amber-400/20'
                          }`}
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Mức Đá */}
                  <div className="space-y-2.5 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Flame size={14} /> Mức Đá cho món này ({iceList.length})
                      </label>
                    </div>

                    {/* Active Ice Badges */}
                    <div className="flex flex-wrap gap-1.5 min-h-9 p-2 rounded-xl bg-zinc-900 border border-zinc-800/80 items-center">
                      {iceList.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-xs font-bold shadow-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveIce(tag)}
                            className="text-cyan-400/60 hover:text-red-400 transition-colors"
                            title="Xóa mức đá này"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                      {iceList.length === 0 && (
                        <span className="text-xs text-zinc-500 italic">Chưa chọn mức đá nào...</span>
                      )}
                    </div>

                    {/* Add Ice Input & Presets */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newIceInput}
                        onChange={(e) => setNewIceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddIce(newIceInput);
                          }
                        }}
                        placeholder="Thêm mức đá tùy chỉnh..."
                        className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-100 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddIce(newIceInput)}
                        className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} /> Thêm
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="text-[10px] text-zinc-500 font-bold self-center mr-1">Gợi ý nhanh:</span>
                      {ICE_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleAddIce(preset)}
                          disabled={iceList.includes(preset)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            iceList.includes(preset)
                              ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                              : 'bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 hover:bg-cyan-400/20'
                          }`}
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Dish Card Live Preview */}
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-3xl space-y-3">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Xem trước hiển thị món ăn (Preview)
              </span>
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                  {previewUrl ? (
                    <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">
                      {watchIsDrink ? "🍹" : "🍱"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-zinc-100 text-sm truncate">{watchName || "Tên món ăn"}</h5>
                  <p className="text-xs font-bold text-violet-400 mt-0.5">
                    {watchPrice ? Number(watchPrice).toLocaleString('vi-VN') : "0"} VND
                  </p>
                  {watchIsDrink ? (
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-violet-400/10 text-violet-300 border border-violet-400/20 mt-1">
                      Đồ uống (Có Đường, Đá & Topping)
                    </span>
                  ) : (
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 mt-1">
                      Món ăn thường
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Modal Actions Footer */}
      <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-6 py-3 border border-zinc-800 text-zinc-400 rounded-2xl text-xs font-bold hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-50 transition-all cursor-pointer"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-500 text-white rounded-2xl text-xs font-black hover:from-violet-500 hover:to-indigo-400 active:scale-98 disabled:opacity-50 shadow-xl shadow-violet-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer min-w-32"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Tải lên...
            </>
          ) : initialData ? (
            "Lưu Cập Nhật"
          ) : (
            "Thêm Món Mới"
          )}
        </button>
      </div>
    </form>
  );
}
