"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Upload, X, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import { getAccessTokenFromCookie } from "@/lib/auth/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const menuItemSchema = z.object({
  name: z.string().min(2, "Tên món ăn phải có ít nhất 2 ký tự"),
  description: z.string().optional(),
  price: z.number({ message: "Giá tiền phải là một số" }).positive("Giá tiền phải lớn hơn 0"),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục món ăn"),
  isActive: z.boolean(),
  isSoldOut: z.boolean(),
});

type MenuItemFormValues = z.infer<typeof menuItemSchema>;

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
  isSoldOut: boolean;
}

interface MenuItemFormProps {
  categories: Category[];
  initialData?: MenuItem | null;
  onSubmitSuccess: () => void;
  onCancel: () => void;
}

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
    setValue,
    formState: { errors },
  } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price ? Number(initialData.price) : (undefined as any),
      categoryId: initialData?.categoryId || "",
      isActive: initialData?.isActive ?? true,
      isSoldOut: initialData?.isSoldOut ?? false,
    },
  });

  // Hủy Preview URL cũ để giải phóng bộ nhớ khi Component bị unmount hoặc đổi file
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

    // Chỉ cho phép ảnh dưới 5MB
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Kích thước file ảnh vượt quá giới hạn 5MB");
      return;
    }

    // Chỉ cho phép định dạng PNG, JPG, WEBP
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setSubmitError("Định dạng ảnh không hợp lệ (Chỉ nhận JPG, PNG, WEBP)");
      return;
    }

    setSubmitError(null);
    setSelectedFile(file);
    
    // Tạo Object URL cho ảnh preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const onSubmit = async (values: MenuItemFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("description", values.description || "");
      formData.append("price", String(values.price));
      formData.append("categoryId", values.categoryId);
      formData.append("isActive", String(values.isActive));
      formData.append("isSoldOut", String(values.isSoldOut));

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-zinc-300">
      {submitError && (
        <div className="p-3.5 bg-red-950/20 text-red-400 rounded-lg text-xs font-bold border border-red-900/30 animate-pulse">
          ⚠️ {submitError}
        </div>
      )}

      {/* Tên món ăn */}
      <div>
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
          Tên món ăn <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("name")}
          placeholder="Ví dụ: Cà phê sữa đá, Bún bò Huế..."
          className={`w-full px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-100 bg-zinc-900/60 shadow-inner ${
            errors.name ? "border-red-500/50 bg-red-950/20 text-red-200" : "border-zinc-800 focus:border-orange-500/40"
          }`}
        />
        {errors.name && (
          <p className="text-[11px] text-red-400 font-extrabold mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Danh mục và Giá */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Danh mục */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
            Danh mục <span className="text-red-500">*</span>
          </label>
          <select
            {...register("categoryId")}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-100 bg-zinc-900/60 shadow-inner ${
              errors.categoryId ? "border-red-500/50 bg-red-950/20 text-red-200" : "border-zinc-800 focus:border-orange-500/40"
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
            <p className="text-[11px] text-red-400 font-extrabold mt-1">{errors.categoryId.message}</p>
          )}
        </div>

        {/* Giá tiền */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
            Giá bán (VND) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register("price", { valueAsNumber: true })}
            placeholder="Ví dụ: 35000"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-100 bg-zinc-900/60 shadow-inner ${
              errors.price ? "border-red-500/50 bg-red-950/20 text-red-200" : "border-zinc-800 focus:border-orange-500/40"
            }`}
          />
          {errors.price && (
            <p className="text-[11px] text-red-400 font-extrabold mt-1">{errors.price.message}</p>
          )}
        </div>
      </div>

      {/* Mô tả ngắn */}
      <div>
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
          Mô tả món ăn
        </label>
        <textarea
          {...register("description")}
          rows={3}
          placeholder="Mô tả thành phần, độ cay, hương vị..."
          className="w-full px-4 py-2.5 rounded-lg border border-zinc-800 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-900/60 text-zinc-100 placeholder-zinc-500 shadow-inner"
        />
      </div>

      {/* Upload Hình ảnh */}
      <div>
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
          Hình ảnh món ăn
        </label>
        
        {previewUrl ? (
          <div className="relative w-full h-44 rounded-xl overflow-hidden group border border-zinc-800 bg-zinc-950 shadow-inner">
            <Image
              src={previewUrl}
              alt="Món ăn preview"
              fill
              className="object-cover transition-transform group-hover:scale-102"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <label className="p-2 bg-zinc-900 text-zinc-200 rounded-full hover:bg-orange-500 hover:text-white transition-colors cursor-pointer shadow-md border border-zinc-800">
                <Upload size={16} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-2 bg-zinc-900 text-red-400 rounded-full hover:bg-red-600 hover:text-white transition-colors shadow-md border border-zinc-800"
              >
                <X size={16} />
              </button>
            </div>
            {selectedFile && (
              <span className="absolute bottom-2.5 left-2.5 bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-md flex items-center gap-1">
                <Sparkles size={10} /> Sẵn sàng upload
              </span>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-zinc-800 rounded-xl cursor-pointer bg-zinc-900/20 hover:bg-orange-500/5 hover:border-orange-500/40 transition-all group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <div className="p-3 bg-orange-500/10 rounded-full text-orange-500 group-hover:scale-110 transition-transform mb-3 border border-orange-500/20 bg-orange-500/10">
                <Upload size={22} className="stroke-[2.5]" />
              </div>
              <p className="text-xs font-extrabold text-zinc-300">Tải ảnh lên Cloudinary</p>
              <p className="text-[10px] text-zinc-500 mt-1 font-semibold">Định dạng JPG, PNG, WEBP (Max 5MB)</p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Trạng thái Món ăn (Hoạt động / Hết món) */}
      <div className="grid grid-cols-2 gap-4 p-4.5 bg-zinc-900/40 rounded-xl border border-zinc-900">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            {...register("isActive")}
            className="w-4 h-4 rounded text-orange-500 border-zinc-800 focus:ring-orange-500/40 cursor-pointer bg-zinc-950"
          />
          <div>
            <p className="text-xs font-extrabold text-zinc-200">Hoạt động</p>
            <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">Cho phép hiển thị trên Menu</p>
          </div>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            {...register("isSoldOut")}
            className="w-4 h-4 rounded text-orange-500 border-zinc-800 focus:ring-orange-500/40 cursor-pointer bg-zinc-950"
          />
          <div>
            <p className="text-xs font-extrabold text-zinc-200">Hết món</p>
            <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">Hiển thị nhãn hết món</p>
          </div>
        </label>
      </div>

      {/* Nút hành động */}
      <div className="flex gap-3 justify-end border-t border-zinc-900/60 pt-4 mt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-5 py-2.5 border border-zinc-800 text-zinc-400 rounded-lg text-sm font-bold hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-50 transition-all cursor-pointer"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-500 text-white rounded-lg text-sm font-black hover:from-orange-500 hover:to-amber-400 active:scale-98 disabled:opacity-50 shadow-lg shadow-orange-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer min-w-32"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Tải lên...
            </>
          ) : initialData ? (
            "Cập nhật"
          ) : (
            "Thêm mới"
          )}
        </button>
      </div>
    </form>
  );
}
