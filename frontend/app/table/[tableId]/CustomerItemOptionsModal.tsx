"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { X, Plus, Minus, Check, UtensilsCrossed } from "lucide-react";
import { getStoredSizes, getStoredToppings, OptionItem } from "@/components/ToppingManagerModal";

export type CustomerMenuItem = {
  id: string;
  name: string;
  englishName?: string | null;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isSoldOut: boolean;
  categorySlug?: string;
};

interface CustomerItemOptionsModalProps {
  isOpen: boolean;
  item: CustomerMenuItem | null;
  onClose: () => void;
  onAddToCart: (cartPayload: {
    menuItemId: string;
    name: string;
    englishName?: string | null;
    price: number;
    imageUrl?: string | null;
    quantity: number;
    optionsNote?: string;
    selectedSize?: string;
    selectedSugar?: string;
    selectedIce?: string;
    selectedToppings?: string[];
  }) => void;
  primaryColor?: string;
  secondaryColor?: string;
}

const SUGAR_LEVELS = ["100% đường", "70% đường", "50% đường", "30% đường", "Không đường"];
const ICE_LEVELS = ["100% đá", "70% đá", "50% đá", "Ít đá", "Không đá"];

// Helper lọc bỏ chuỗi JSON rác trong trường englishName nếu có
const isCleanEnglishName = (name?: string | null) => {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.includes('"sugar"') || trimmed.includes('"ice"')) {
    return false;
  }
  return true;
};

export default function CustomerItemOptionsModal({
  isOpen,
  item,
  onClose,
  onAddToCart,
  primaryColor = "#7c3aed", // default violet theme
  secondaryColor = "#6366f1",
}: CustomerItemOptionsModalProps) {
  const [sizes, setSizes] = useState<OptionItem[]>([]);
  const [toppings, setToppings] = useState<OptionItem[]>([]);

  // Selection states
  const [selectedSize, setSelectedSize] = useState<OptionItem | null>(null);
  const [selectedSugar, setSelectedSugar] = useState<string>("100% đường");
  const [selectedIce, setSelectedIce] = useState<string>("100% đá");
  const [selectedToppings, setSelectedToppings] = useState<OptionItem[]>([]);
  const [note, setNote] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  // Check if item is a drink based on category or item name
  const isDrink = useMemo(() => {
    if (!item) return false;
    const name = String(item.name || "").toLowerCase();
    const catRaw = (item as any).category || (item as any).categoryName || item.categorySlug || "";
    const cat = (typeof catRaw === "string" ? catRaw : String((catRaw as any)?.name || "")).toLowerCase();
    const drinkKeywords = [
      "uống", "trà", "cà phê", "coffee", "tea", "sinh tố", "nước", 
      "sữa", "soda", "nước ngọt", "juice", "smoothie", "latte", 
      "espresso", "matcha", "boba", "đồ uống", "cocktail", "bia"
    ];
    return drinkKeywords.some((k) => name.includes(k) || cat.includes(k));
  }, [item]);

  // Load custom sizes & toppings
  useEffect(() => {
    const loadOptions = () => {
      const activeSizes = getStoredSizes().filter((s) => s.isActive);
      const activeToppings = getStoredToppings().filter((t) => t.isActive);
      setSizes(activeSizes);
      setToppings(activeToppings);

      if (activeSizes.length > 0) {
        setSelectedSize(activeSizes[0]);
      }
    };

    loadOptions();
    window.addEventListener("options_updated", loadOptions);
    return () => window.removeEventListener("options_updated", loadOptions);
  }, [isOpen]);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Reset states when item opens
  useEffect(() => {
    if (item) {
      const activeSizes = getStoredSizes().filter((s) => s.isActive);
      setSelectedSize(isDrink && activeSizes.length > 0 ? activeSizes[0] : null);
      setSelectedSugar(isDrink ? "100% đường" : "");
      setSelectedIce(isDrink ? "100% đá" : "");
      setSelectedToppings([]);
      setNote("");
      setQuantity(1);
    }
  }, [item, isDrink]);

  // Calculate pricing
  const basePrice = item ? Number(item.price) : 0;
  const sizeAdj = isDrink && selectedSize ? Number(selectedSize.priceAdjustment) : 0;
  const toppingsAdj = isDrink ? selectedToppings.reduce((sum, t) => sum + Number(t.priceAdjustment), 0) : 0;
  const unitPrice = basePrice + sizeAdj + toppingsAdj;
  const totalPrice = unitPrice * quantity;

  if (!isOpen || !item) return null;

  const handleToggleTopping = (topping: OptionItem) => {
    setSelectedToppings((prev) =>
      prev.some((t) => t.id === topping.id)
        ? prev.filter((t) => t.id !== topping.id)
        : [...prev, topping]
    );
  };

  const handleConfirmAddToCart = () => {
    const toppingNames = isDrink ? selectedToppings.map((t) => t.name) : [];
    
    // Construct descriptive option note summary
    const optionSummaryParts: string[] = [];
    if (isDrink && selectedSize) optionSummaryParts.push(`Size: ${selectedSize.name}`);
    if (isDrink) {
      if (selectedSugar) optionSummaryParts.push(`Đường: ${selectedSugar}`);
      if (selectedIce) optionSummaryParts.push(`Đá: ${selectedIce}`);
      if (toppingNames.length > 0) optionSummaryParts.push(`Topping: ${toppingNames.join(", ")}`);
    }
    if (note.trim()) optionSummaryParts.push(`Ghi chú: ${note.trim()}`);

    const finalNote = optionSummaryParts.join(" • ");

    onAddToCart({
      menuItemId: item.id,
      name: (isDrink && selectedSize) ? `${item.name} (${selectedSize.name})` : item.name,
      englishName: isCleanEnglishName(item.englishName) ? item.englishName : null,
      price: unitPrice,
      imageUrl: item.imageUrl,
      quantity: quantity,
      optionsNote: finalNote,
      selectedSize: isDrink ? selectedSize?.name : undefined,
      selectedSugar: isDrink ? selectedSugar : undefined,
      selectedIce: isDrink ? selectedIce : undefined,
      selectedToppings: toppingNames,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
      
      {/* Full Screen Mobile Container / Centered Modal Desktop */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full sm:h-auto sm:max-w-lg bg-white rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-gray-900 relative animate-in slide-in-from-bottom-5 duration-300"
      >
        {/* Mobile Header Bar with Theme Dot & Close Icon */}
        <div className="sm:hidden pt-3 pb-2.5 px-4 flex items-center justify-between bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-xs font-black uppercase tracking-wider text-gray-900">Tuỳ chọn</span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-full text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Banner image */}
        <div className="relative w-full h-44 sm:h-48 bg-gray-100 shrink-0 border-b border-gray-100">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 500px"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
              <UtensilsCrossed size={48} className="opacity-40" />
            </div>
          )}

          {/* Desktop close button */}
          <button
            onClick={onClose}
            type="button"
            className="hidden sm:flex absolute top-3 right-3 h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white items-center justify-center backdrop-blur-md transition-all active:scale-90 z-10 cursor-pointer shadow-md"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>

          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 text-white">
            <h3 className="text-base sm:text-lg font-black leading-tight drop-shadow-xs">{item.name}</h3>
            {isCleanEnglishName(item.englishName) && (
              <p className="text-xs text-gray-300 font-light truncate">{item.englishName}</p>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-extrabold" style={{ color: primaryColor }}>
                {basePrice.toLocaleString("vi-VN")} VND
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Customization Options (Full Height Content Area) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 scrollbar-none [::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {/* 1. Size Selection (CHỈ HIỂN THỊ KHI LÀ ĐỒ UỐNG) */}
          {isDrink && sizes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  Kích Thước (Size)
                </label>
                <span 
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                  style={{ 
                    backgroundColor: `${primaryColor}15`, 
                    borderColor: `${primaryColor}40`, 
                    color: primaryColor 
                  }}
                >
                  Bắt buộc
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {sizes.map((s) => {
                  const isSelected = selectedSize?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className="p-2.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer min-h-[64px]"
                      style={
                        isSelected
                          ? {
                              borderColor: primaryColor,
                              backgroundColor: `${primaryColor}12`,
                              color: primaryColor,
                              boxShadow: `0 0 10px ${primaryColor}20`,
                            }
                          : {
                              borderColor: "#e5e7eb",
                              backgroundColor: "#ffffff",
                              color: "#374151",
                            }
                      }
                    >
                      <span className="font-bold text-xs leading-tight line-clamp-1">{s.name}</span>
                      <span 
                        className="text-[11px] font-extrabold mt-1"
                        style={{ color: primaryColor }}
                      >
                        +{Number(s.priceAdjustment).toLocaleString("vi-VN")}đ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2 & 3. Sugar & Ice Selection (CHỈ HIỂN THỊ CHO ĐỒ UỐNG) */}
          {isDrink && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  Mức Đường
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SUGAR_LEVELS.map((sugar) => {
                    const isSelected = selectedSugar === sugar;
                    return (
                      <button
                        key={sugar}
                        type="button"
                        onClick={() => setSelectedSugar(sugar)}
                        className="px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer"
                        style={
                          isSelected
                            ? {
                                borderColor: primaryColor,
                                backgroundColor: primaryColor,
                                color: "#ffffff",
                                fontWeight: "bold",
                              }
                            : {
                                borderColor: "#e5e7eb",
                                backgroundColor: "#f9fafb",
                                color: "#4b5563",
                              }
                        }
                      >
                        {sugar}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  Mức Đá
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ICE_LEVELS.map((ice) => {
                    const isSelected = selectedIce === ice;
                    return (
                      <button
                        key={ice}
                        type="button"
                        onClick={() => setSelectedIce(ice)}
                        className="px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer"
                        style={
                          isSelected
                            ? {
                                borderColor: primaryColor,
                                backgroundColor: primaryColor,
                                color: "#ffffff",
                                fontWeight: "bold",
                              }
                            : {
                                borderColor: "#e5e7eb",
                                backgroundColor: "#f9fafb",
                                color: "#4b5563",
                              }
                        }
                      >
                        {ice}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 4. Topping Selection (CHỈ HIỂN THỊ CHO ĐỒ UỐNG) */}
          {isDrink && toppings.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                Thêm Topping (Tùy chọn)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {toppings.map((t) => {
                  const isSelected = selectedToppings.some((item) => item.id === t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleTopping(t)}
                      className="p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer"
                      style={
                        isSelected
                          ? {
                              borderColor: primaryColor,
                              backgroundColor: `${primaryColor}10`,
                              color: "#111827",
                            }
                          : {
                              borderColor: "#e5e7eb",
                              backgroundColor: "#ffffff",
                              color: "#374151",
                            }
                      }
                    >
                      <div>
                        <div className="font-bold text-xs leading-tight">{t.name}</div>
                        <div className="text-[11px] font-bold mt-0.5" style={{ color: primaryColor }}>
                          +{Number(t.priceAdjustment).toLocaleString("vi-VN")}đ
                        </div>
                      </div>
                      <div 
                        className="w-4 h-4 rounded flex items-center justify-center transition-colors shrink-0"
                        style={
                          isSelected
                            ? { backgroundColor: primaryColor, color: "#ffffff" }
                            : { border: "1px solid #d1d5db", backgroundColor: "#f9fafb" }
                        }
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Ghi chú món */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wider block">
              Ghi chú
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Ít béo, không hành, bớt cay..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white transition-all font-medium"
            />
          </div>
        </div>

        {/* Footer Bar: Quantity Selector & CTA Button */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3 shrink-0 pb-8 sm:pb-4">
          {/* Quantity Selector */}
          <div className="flex items-center border border-gray-200 bg-white rounded-xl p-1 shadow-xs shrink-0">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-all active:scale-95 cursor-pointer"
            >
              <Minus size={15} />
            </button>
            <span className="w-7 text-center font-black text-gray-900 text-sm tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            type="button"
            onClick={handleConfirmAddToCart}
            className="flex-1 py-3.5 px-4 rounded-2xl text-white font-bold text-sm shadow-lg flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              boxShadow: `0 8px 25px -4px ${primaryColor}40`,
            }}
          >
            <span className="whitespace-nowrap">Thêm vào giỏ</span>
            <span className="whitespace-nowrap font-mono font-extrabold text-sm bg-white/20 px-2.5 py-1 rounded-xl backdrop-blur-xs ml-2">
              {totalPrice.toLocaleString("vi-VN")}đ
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
